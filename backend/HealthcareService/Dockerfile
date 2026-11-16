FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["HealthcareService/HealthcareService.csproj", "HealthcareService/"]
COPY ["HealthcareService.Core/HealthcareService.Core.csproj", "HealthcareService.Core/"]
COPY ["HealthcareService.Infrastructure/HealthcareService.Infrastructure.csproj", "HealthcareService.Infrastructure/"]
RUN dotnet restore "HealthcareService/HealthcareService.csproj"

COPY . .
WORKDIR "/src/HealthcareService"
RUN dotnet publish "HealthcareService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 5020
ENV ASPNETCORE_URLS=http://0.0.0.0:5020
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "HealthcareService.dll"]
