FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["ApiGateway/ApiGateway.csproj", "ApiGateway/"]
COPY ["Healthcare.Common/Healthcare.Common.csproj", "Healthcare.Common/"]
RUN dotnet restore "ApiGateway/ApiGateway.csproj"

COPY . .
WORKDIR "/src/ApiGateway"
RUN dotnet publish "ApiGateway.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://0.0.0.0:5000
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ApiGateway.dll"]
