namespace HealthcareService.Core.Interfaces
{
    public interface IAiService
    {
        IAsyncEnumerable<string> StreamPatientSummaryAsync(int patientId, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> StreamPatientChatAsync(int patientId, string userQuestion, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> StreamNurseShiftSummaryAsync(CancellationToken cancellationToken = default);
    }
}
