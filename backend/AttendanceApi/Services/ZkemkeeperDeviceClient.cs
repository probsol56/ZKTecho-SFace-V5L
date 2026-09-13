using zkemkeeper;

namespace AttendanceApi.Services;

// Wraps ZKTeco's zkemkeeper.dll COM SDK (CZKEM), the same component the ZKTeco
// "Att.exe" desktop software uses to talk to standalone terminals like the
// SpeedFace-V5L over TCP/IP. It's a 32-bit-only COM server registered via
// regsvr32 (ProgID zkemkeeper.ZKEM) - see AttendanceApi.csproj for the
// PlatformTarget=x86 requirement and the generated interop reference.
//
// The SDK's read APIs are cursor-based: ReadAllUserID/ReadGeneralLogData pull the
// whole table into an in-memory buffer on the device connection, then
// SSR_GetAllUserInfo/SSR_GetGeneralLogData are called repeatedly to drain one row
// at a time until they return false.
public class ZkemkeeperDeviceClient : IZkDeviceClient
{
    // The SDK addresses connections by a machine-number handle, not IP - after
    // Connect_Net establishes a single-device session this is always 1.
    private const int MachineNumber = 1;

    public Task<IReadOnlyList<DeviceUserRecord>> GetUsersAsync(string ipAddress, int port)
    {
        return Task.Run<IReadOnlyList<DeviceUserRecord>>(() =>
        {
            var zk = Connect(ipAddress, port);
            try
            {
                var users = new List<DeviceUserRecord>();
                if (zk.ReadAllUserID(MachineNumber))
                {
                    while (zk.SSR_GetAllUserInfo(
                               MachineNumber,
                               out var deviceUserId,
                               out var name,
                               out _,
                               out var privilege,
                               out _))
                    {
                        zk.GetStrCardNumber(out var cardNumber);
                        users.Add(new DeviceUserRecord(
                            deviceUserId,
                            name,
                            string.IsNullOrWhiteSpace(cardNumber) ? null : cardNumber,
                            privilege));
                    }
                }
                return users;
            }
            finally
            {
                zk.Disconnect();
            }
        });
    }

    public Task<IReadOnlyList<DeviceAttendanceRecord>> GetAttendanceLogsAsync(string ipAddress, int port)
    {
        return Task.Run<IReadOnlyList<DeviceAttendanceRecord>>(() =>
        {
            var zk = Connect(ipAddress, port);
            try
            {
                var logs = new List<DeviceAttendanceRecord>();
                var workCode = 0; // [in, out] param the SDK doesn't actually consume as input
                if (zk.ReadGeneralLogData(MachineNumber))
                {
                    while (zk.SSR_GetGeneralLogData(
                               MachineNumber,
                               out var deviceUserId,
                               out var verifyMode,
                               out var inOutMode,
                               out var year,
                               out var month,
                               out var day,
                               out var hour,
                               out var minute,
                               out var second,
                               ref workCode))
                    {
                        // The terminal reports its own wall clock, configured to the
                        // office timezone - not the API host's, which may differ.
                        var timestamp = BusinessTime.ToUtc(
                            new DateTime(year, month, day, hour, minute, second));
                        logs.Add(new DeviceAttendanceRecord(deviceUserId, timestamp, verifyMode, inOutMode));
                    }
                }
                return logs;
            }
            finally
            {
                zk.Disconnect();
            }
        });
    }

    private const int MaxFingerIndex = 9; // ZK protocol supports finger slots 0-9
    private const int FaceIndex = 0; // zkemkeeper stores a single primary face template per user

    public Task<IReadOnlyDictionary<string, DeviceUserTemplates>> GetTemplatesAsync(
        string ipAddress, int port, IReadOnlyList<string> deviceUserIds)
    {
        return Task.Run<IReadOnlyDictionary<string, DeviceUserTemplates>>(() =>
        {
            var zk = Connect(ipAddress, port);
            try
            {
                var result = new Dictionary<string, DeviceUserTemplates>();
                foreach (var deviceUserId in deviceUserIds)
                {
                    var fingerprints = new List<DeviceTemplateRecord>();
                    for (var fingerIndex = 0; fingerIndex <= MaxFingerIndex; fingerIndex++)
                    {
                        if (zk.GetUserTmpExStr(
                                MachineNumber, deviceUserId, fingerIndex, out var flag, out var tmpData, out var tmpLength)
                            && tmpLength > 0)
                        {
                            fingerprints.Add(new DeviceTemplateRecord(TemplateKind.Fingerprint, fingerIndex, flag, tmpData));
                        }
                    }

                    var faces = new List<DeviceTemplateRecord>();
                    var faceData = string.Empty;
                    var faceLength = 0;
                    if (zk.GetUserFaceStr(MachineNumber, deviceUserId, FaceIndex, ref faceData, ref faceLength)
                        && faceLength > 0)
                    {
                        faces.Add(new DeviceTemplateRecord(TemplateKind.Face, FaceIndex, 0, faceData));
                    }

                    var templates = new DeviceUserTemplates(fingerprints, faces);
                    if (!templates.IsEmpty)
                    {
                        result[deviceUserId] = templates;
                    }
                }
                return result;
            }
            finally
            {
                zk.Disconnect();
            }
        });
    }

    public Task WriteTemplatesAsync(
        string ipAddress, int port,
        IReadOnlyList<(DeviceUserRecord User, DeviceUserTemplates Templates)> users,
        Action<string, bool> onProgress)
    {
        return Task.Run(() =>
        {
            var zk = Connect(ipAddress, port);
            try
            {
                // Disable the device while writing so an in-progress finger/face
                // scan can't race the enrollment write for the same user.
                zk.EnableDevice(MachineNumber, false);

                foreach (var (user, templates) in users)
                {
                    // SSR_SetUserInfo has no card-number parameter - the SDK reads it
                    // from this "current" context, which persists across calls on the
                    // same connection. Always set it (blank when absent) so a card
                    // number doesn't leak from the previous user in this batch.
                    zk.SetStrCardNumber(user.CardNumber ?? string.Empty);

                    var userOk = zk.SSR_SetUserInfo(MachineNumber, user.DeviceUserId, user.Name, string.Empty, user.Role, true);
                    if (!userOk)
                    {
                        onProgress(user.DeviceUserId, false);
                        continue;
                    }

                    var templatesOk = true;
                    foreach (var fingerprint in templates.Fingerprints)
                    {
                        templatesOk &= zk.SetUserTmpExStr(
                            MachineNumber, user.DeviceUserId, fingerprint.Index, fingerprint.Flag, fingerprint.Data);
                    }

                    foreach (var face in templates.Faces)
                    {
                        templatesOk &= zk.SetUserFaceStr(MachineNumber, user.DeviceUserId, face.Index, face.Data, face.Data.Length);
                    }

                    onProgress(user.DeviceUserId, templatesOk);
                }

                zk.RefreshData(MachineNumber);
            }
            finally
            {
                zk.EnableDevice(MachineNumber, true);
                zk.Disconnect();
            }
        });
    }

    private static CZKEMClass Connect(string ipAddress, int port)
    {
        var zk = new CZKEMClass();
        if (!zk.Connect_Net(ipAddress, port))
        {
            throw new InvalidOperationException($"Could not connect to device at {ipAddress}:{port}");
        }
        return zk;
    }
}
