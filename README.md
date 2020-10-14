# serverless-challenge
Build a serverless architecture for image analysis 

![Screenshot](Architecture.png)

## Notes
* After deploying the solution using `serverless deploy`, a folder ("_upload_") must be manually created within the S3 bucket via the S3 Console.
* Please note that files must be uploaded to the above-created folder ("_upload_") - any files uploaded to the root won't be processed by the `ExtractMetadata` function.
* More detailed documentation about the serverless deployment and functions implemented can be found in the _serverless.yml_ and _handler.js_ files.
