using AttendanceApi.Data;
using AttendanceApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

public record UpdateEmployeeRequest(string Name, bool IsActive, DateOnly? JoinDate);

[ApiController]
[Route("api/[controller]")]
public class EmployeesController(AttendanceDbContext db) : ControllerBase
{
    private const int MaxPageSize = 200;
    private const int DefaultPageSize = 20;

    [HttpGet]
    public async Task<ActionResult<PagedResult<Employee>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page = Math.Max(page, 1);

        var query = db.Employees.OrderBy(e => e.Name);

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedResult<Employee>(items, page, pageSize, totalCount, totalPages);
    }

    // Employees are created by device sync, but IsActive and JoinDate are HR facts the
    // terminal knows nothing about - they decide who absence is generated for.
    // DeviceUserId, CardNumber and Role stay device-owned and are not editable here.
    [HttpPut("{id:int}")]
    public async Task<ActionResult<Employee>> Update(
        int id,
        [FromBody] UpdateEmployeeRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");

        var employee = await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (employee is null) return NotFound();

        employee.Name = request.Name.Trim();
        employee.IsActive = request.IsActive;
        employee.JoinDate = request.JoinDate;

        await db.SaveChangesAsync(ct);

        return employee;
    }
}
