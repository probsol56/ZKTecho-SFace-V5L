using AttendanceApi.Data;
using AttendanceApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

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
}
