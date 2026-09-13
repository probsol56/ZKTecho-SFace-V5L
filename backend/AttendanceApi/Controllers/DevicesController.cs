using System.Text.Json;
using System.Threading.Channels;
using AttendanceApi.Data;
using AttendanceApi.Models;
using AttendanceApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

public record CreateDeviceRequest(string Name, string IpAddress, int Port, string? SerialNumber);

public record UpdateDeviceRequest(string Name, string IpAddress, int Port, string? SerialNumber);

public record TransferTemplatesRequest(int SourceDeviceId, int TargetDeviceId, List<DeviceUserRecord> Employees);

public record TransferStreamErrorPayload(string Message);

[ApiController]
[Route("api/[controller]")]
public class DevicesController(
    AttendanceDbContext db,
    DeviceSyncService syncService,
    DeviceTemplateTransferService transferService,
    IZkDeviceClient deviceClient) : ControllerBase
{
    private static readonly JsonSerializerOptions SseJsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    public async Task<ActionResult<List<Device>>> GetAll()
    {
        return await db.Devices.OrderBy(d => d.Name).ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<Device>> Create(CreateDeviceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.IpAddress))
        {
            return BadRequest("Name and IP address are required.");
        }

        var device = new Device
        {
            Name = request.Name,
            IpAddress = request.IpAddress,
            Port = request.Port == 0 ? 4370 : request.Port,
            SerialNumber = request.SerialNumber,
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = device.Id }, device);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Device>> Update(int id, UpdateDeviceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.IpAddress))
        {
            return BadRequest("Name and IP address are required.");
        }

        var device = await db.Devices.FindAsync(id);
        if (device is null) return NotFound();

        device.Name = request.Name;
        device.IpAddress = request.IpAddress;
        device.Port = request.Port == 0 ? 4370 : request.Port;
        device.SerialNumber = request.SerialNumber;
        await db.SaveChangesAsync();
        return Ok(device);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var device = await db.Devices.FindAsync(id);
        if (device is null) return NotFound();

        db.Devices.Remove(device);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/sync")]
    public async Task<ActionResult<SyncResult>> Sync(int id, CancellationToken ct)
    {
        try
        {
            var result = await syncService.SyncAsync(id, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    // Streams one Server-Sent Event per employee as their transfer completes,
    // rather than one response after the whole batch finishes - so a UI can show
    // live per-employee progress instead of a single opaque "transferring…" wait.
    // A Channel bridges the synchronous onProgress callback (invoked from the
    // background thread doing the actual device I/O, see ZkemkeeperDeviceClient)
    // to this async request handler, which awaits and flushes each event in order.
    [HttpPost("transfer-templates")]
    public async Task TransferTemplates(TransferTemplatesRequest request, CancellationToken ct)
    {
        if (request.Employees.Count == 0)
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            await Response.WriteAsync("At least one employee is required.", ct);
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";

        var channel = Channel.CreateUnbounded<TemplateTransferOutcome>();

        var transferTask = Task.Run(async () =>
        {
            try
            {
                await transferService.TransferAsync(
                    request.SourceDeviceId, request.TargetDeviceId, request.Employees,
                    outcome => channel.Writer.TryWrite(outcome), ct);
                channel.Writer.Complete();
            }
            catch (Exception ex)
            {
                channel.Writer.Complete(ex);
            }
        }, ct);

        try
        {
            await foreach (var outcome in channel.Reader.ReadAllAsync(ct))
            {
                await WriteSseEventAsync("outcome", outcome, ct);
            }
            await WriteSseEventAsync("done", new { }, ct);
        }
        catch (KeyNotFoundException ex)
        {
            await WriteSseEventAsync("error", new TransferStreamErrorPayload(ex.Message), ct);
        }
        catch (ArgumentException ex)
        {
            await WriteSseEventAsync("error", new TransferStreamErrorPayload(ex.Message), ct);
        }
        catch (InvalidOperationException ex)
        {
            await WriteSseEventAsync("error", new TransferStreamErrorPayload(ex.Message), ct);
        }

        await transferTask;
    }

    private async Task WriteSseEventAsync<T>(string eventName, T payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, SseJsonOptions);
        await Response.WriteAsync($"event: {eventName}\ndata: {json}\n\n", ct);
        await Response.Body.FlushAsync(ct);
    }

    // Queries the terminal directly rather than the Employees table, so the
    // transfer page always shows exactly who is enrolled on that specific
    // device - the DB's Employees table has no per-device mapping (see
    // Employee.cs) and can drift from what a given terminal actually holds.
    [HttpGet("{id:int}/live-users")]
    public async Task<ActionResult<List<DeviceUserRecord>>> GetLiveUsers(int id, CancellationToken ct)
    {
        var device = await db.Devices.FindAsync([id], ct);
        if (device is null) return NotFound();

        try
        {
            var users = await deviceClient.GetUsersAsync(device.IpAddress, device.Port);
            return Ok(users.OrderBy(u => u.Name).ToList());
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, ex.Message);
        }
    }
}
