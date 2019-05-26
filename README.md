# ebook-convert-api

A simple REST API for Calibre's ebook-convert utility.

## Setup

### Local Deployment

For local deployment, the following dependencies are required:

- node.js (tested on version 10)
- ebook-convert within the PATH

### Heroku Deployment

For Heroku deployment, the calibre buildpack can be used to install calibre.

1. Create the application by running `heroku create`
2. Set the base buildpack: `buildpacks:set heroku/nodejs`
3. Add the calibre buildpack: `heroku buildpacks:add --index 1 https://github.com/pawitp/heroku-buildpack-calibre.git`
4. Set the API key: `heroku config:set API_KEY=your-api-key`

## Usage

The swagger documentation can be viewed by running the application and opening http://localhost:5000/api-docs. Alternatively, you can view the documentation using the online Swagger Editor: https://editor.swagger.io/?url=https://raw.githubusercontent.com/pawitp/ebook-convert-api/master/swagger.yaml.

Basic usage flow is as follows:

- Call `/upload` to upload all relevant resources
- Call `/convert` to convert the document into the desired format
- Call `/get` to download the converted document

If there are additional resources such as images, they must be uploaded one-by-one and referenced using the file name returned in the `href` response.

## Security

This API is for personal usage and only basic API key authentication is implemented. The GET methods do not require authentication as it already impractical to download any given file without knowing the highly random file name.

In addition, CORS is enabled for all hosts for simplicity of calling this API on the client-side from other web applications.
