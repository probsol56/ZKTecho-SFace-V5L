using AttendanceApi.Data;
using AttendanceApi.Models;
using AttendanceApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

public record CreateDeviceRequest(string Name, string IpAddress, int Port, string? SerialNumber);

[ApiController]
[Route("api/[controller]")]
public class DevicesController(AttendanceDbContext db, DeviceSyncService syncService) : ControllerBase
{
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
}
