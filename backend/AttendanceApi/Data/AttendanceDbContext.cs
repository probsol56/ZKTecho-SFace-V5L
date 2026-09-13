using AttendanceApi.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Data;

public class AttendanceDbContext(DbContextOptions<AttendanceDbContext> options) : DbContext(options)
{
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<AttendanceLog> AttendanceLogs => Set<AttendanceLog>();
    public DbSet<WorkSchedule> WorkSchedules => Set<WorkSchedule>();
    public DbSet<DailyAttendance> DailyAttendance => Set<DailyAttendance>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasIndex(e => e.DeviceUserId).IsUnique();

            // Required, or the AddColumn migration backfills every existing employee to
            // false. Side effect: EF treats false as the CLR default on insert and omits
            // it, so an employee cannot be *created* inactive - only updated to inactive.
            entity.Property(e => e.IsActive).HasDefaultValue(true);
        });

        modelBuilder.Entity<AttendanceLog>(entity =>
        {
            entity.HasIndex(l => new { l.EmployeeId, l.DeviceId, l.Timestamp }).IsUnique();

            // The unique index above leads with EmployeeId, so it cannot serve the
            // whole-day range scans the daily rollup runs.
            entity.HasIndex(l => l.Timestamp);
        });

        modelBuilder.Entity<WorkSchedule>(entity =>
        {
            entity.ToTable(t => t.HasCheckConstraint("CK_WorkSchedules_SingleRow", "\"Id\" = 1"));

            // Seed values are frozen: the row is operator-editable, so changing them here
            // would make EF emit an UpdateData that silently reverts their edits.
            entity.HasData(new WorkSchedule
            {
                Id = WorkSchedule.SingletonId,
                StartTime = new TimeOnly(9, 0),
                EndTime = new TimeOnly(19, 0),
                GraceMinutes = 10,
                WeekendDaysMask = WorkSchedule.MaskFor([DayOfWeek.Friday, DayOfWeek.Saturday]),
                UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            });
        });

        modelBuilder.Entity<DailyAttendance>(entity =>
        {
            // Pinned: AttendanceDayService upserts into this table by name via raw SQL.
            entity.ToTable("DailyAttendance");

            entity.HasIndex(d => new { d.EmployeeId, d.WorkDate }).IsUnique();
            entity.HasIndex(d => d.WorkDate);

            entity.HasOne(d => d.Employee)
                .WithMany()
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
