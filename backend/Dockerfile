FROM mcr.microsoft.com/dotnet/sdk:8.0

WORKDIR /src

ENV PATH="${PATH}:/root/.dotnet/tools"

COPY backend.csproj ./
RUN dotnet restore backend.csproj \
    && dotnet tool install --global dotnet-ef

COPY . .

EXPOSE 5017

CMD ["dotnet", "watch", "--non-interactive", "--project", "backend.csproj", "run", "--no-launch-profile"]
