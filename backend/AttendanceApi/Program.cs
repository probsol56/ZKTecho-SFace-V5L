using AttendanceApi.Data;
using AttendanceApi.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AttendanceDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddScoped<IZkDeviceClient, ZkemkeeperDeviceClient>();
builder.Services.AddScoped<DeviceSyncService>();
builder.Services.AddScoped<DeviceTemplateTransferService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// ZK terminals push to ADMS over plain HTTP and won't follow a redirect to
// HTTPS, so /iclock/* is exempted - everything else still gets redirected.
app.UseWhen(
    context => !context.Request.Path.StartsWithSegments("/iclock"),
    branch => branch.UseHttpsRedirection());
app.UseAuthorization();
app.MapControllers();

app.Run();
