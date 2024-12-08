# Cowllector API

## Development

```bash
npm install
npm run dev
```

The server will start at http://localhost:3000

## API Documentation

OpenAPI documentation is available at: 
    http://localhost:3000/api/docs
    https://cowllector.beefy.com/api/docs
Swagger UI is available at: 
    http://localhost:3000/swagger
    https://cowllector.beefy.com/swagger
    

## Test URLs for Last Harvest Reports Endpoint

```
# Get all last harvest reports
http://localhost:3000/api/v1/last-harvest-reports
https://cowllector.beefy.com/api/v1/last-harvest-reports

# Get last harvest report for a specific vault
http://localhost:3000/api/v1/last-harvest-reports/{vaultId}
https://cowllector.beefy.com/api/v1/last-harvest-reports/{vaultId}
```

You can test these URLs in your browser or using tools like curl or Postman. The API will return:
- For the first endpoint: a JSON response with an array containing the last harvest report for each vault
- For the second endpoint: a JSON response with the last harvest report for the specified vault
