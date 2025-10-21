# im-girisankar/git-to-doc-backend 📦

## 📖 Overview
The `git-to-doc-backend` project is a Node.js application designed to convert GitHub repositories into documentation. It aims to solve the problem of generating documentation for large-scale software projects by automating the process using API endpoints and data analysis.

This project provides a simple yet powerful way to generate documentation from GitHub repositories, making it an essential tool for developers and teams working on complex projects.

## ✨ Features
* Convert GitHub repository data into documentation
* Supports multiple API endpoints for health checks, analysis, and documentation generation
* Highly customizable using environment variables and configuration options

## 🏗️ Architecture / How It Works
The `git-to-doc-backend` project is built using a microservices architecture, with each component responsible for a specific task. The system consists of the following components:

1. **API Gateway**: Handles incoming requests from clients and routes them to the appropriate endpoint.
2. **Health Check Service**: Provides health checks for the application, ensuring it's running smoothly.
3. **Analysis Service**: Analyzes data from the GitHub repository and generates documentation based on the analysis results.
4. **Documentation Generation Service**: Responsible for generating the final documentation in various formats (e.g., HTML, PDF).

The system uses a request-response cycle to process incoming requests:

1. Client sends a request to the API Gateway
2. API Gateway routes the request to the Analysis Service or Documentation Generation Service
3. The respective service processes the request and generates the required data
4. The generated data is sent back to the client through the API Gateway

## 🚀 Installation

### Prerequisites
* Node.js (14.x or higher)
* npm (6.x or higher)

### Setup Steps
```bash
# Clone the repository
git clone https://github.com/im-girisankar/git-to-doc-backend.git

# Install dependencies
npm install

# Configure environment variables (see Configuration section below)
```

## 📖 Usage

### Basic Usage
To run the application, execute the following command:
```bash
npm start
```
This will start the API Gateway and begin listening for incoming requests.

### Configuration
The application uses environment variables to configure settings. The most important ones are:

* `NODE_ENV`: Set to either "development" or "production"
* `PORT`: Specify the port number (default: 3001)
* `GITHUB_TOKEN`: Provide a valid GitHub token for authentication

You can set these variables in your `.env` file:
```bash
# .env.example
NODE_ENV=development
PORT=3001
GITHUB_TOKEN=your-github-token
```

### Examples (if applicable)
To generate documentation from a specific repository, send a GET request to the `/api/documentation` endpoint with the repository name as a query parameter:
```bash
curl -X GET \
  http://localhost:3001/api/documentation?repository=my-repo-name
```
This will return the generated documentation in HTML format.

## 📁 Project Structure (if relevant)
The project structure is organized into the following directories:

* `src`: Contains the application code, including services and API endpoints
* `routes`: Defines the routes for each service
* `utils`: Holds utility functions used throughout the application

## 🔌 API Reference

### Health Check Endpoint
* **Method**: GET
* **Path**: `/api/health`
* **Description**: Returns a health check status (200 OK or 500 Internal Server Error)
* **Parameters**: None
* **Response format**: JSON object with a `status` property

### Analysis Endpoint
* **Method**: POST
* **Path**: `/api/analyze`
* **Description**: Analyzes data from the GitHub repository and returns analysis results
* **Parameters**:
	+ `repository`: Name of the GitHub repository to analyze (required)
	+ `token`: Valid GitHub token for authentication (optional)
* **Response format**: JSON object with analysis results

### Documentation Generation Endpoint
* **Method**: GET
* **Path**: `/api/documentation`
* **Description**: Generates documentation from the analyzed data and returns it in HTML format
* **Parameters**:
	+ `repository`: Name of the GitHub repository to generate documentation for (required)
	+ `token`: Valid GitHub token for authentication (optional)
* **Response format**: HTML string containing generated documentation

## 🤝 Contributing
Contributions are welcome! If you'd like to contribute, please fork the repository and submit a pull request with your changes.

## 📄 License
This project is licensed under the MIT License. See the `LICENSE` file for details.

## 🙏 Acknowledgments
The authors would like to thank the following dependencies for their contributions:

* Express.js (API framework)
* Cors (cross-origin resource sharing middleware)
* Morgan (HTTP request logger middleware)