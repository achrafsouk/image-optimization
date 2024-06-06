## Deployment steps

Navigate to the region of your ALB, eu-west-1

First clone the project locally and install dependencies. You can use cloudshell.

```
git clone https://github.com/achrafsouk/image-optimization.git 
cd image-optimization
npm install
cdk bootstrap
```

Then customize the parameters in both files:
* functions/urlrewrite/index.js -> e.g. quality parameter which is set to 90 by default
* lib/image-optimization-stack.ts -> e.g. cache control set for transformed images, and after how many days they will be removed from the bucket

Then you need to expose the images through a reachable domain to the Lambda. Either change the ALB security group to allow Lambda IPs, or create a new cloudfront distributions that point to your alb, and use the cloudfront domain name. this domain will be used by Lambda to fetch original images then trasnform them. 

Then build and deploy the resources using this domain (e.g. images.alb.domain.com)

```
npm run build
cdk deploy -c IMAGE_DOMAIN_NAME=images.alb.domain.com
```

Note the created s3 bucket name, LambdaURL, and the CloudFront Function name

In your web CloudFront distribution where you serve images, do the following:
* Create a new origin with the s3 bucket. Enable OAC (e.g. create a new OAC and add the right permissions to the S3 bucket)
* Create a new origin with the Lambda URL. Enable OAC (e.g. create a new OAC and add the right permissions to the Lambda)
* Create an origin group using the above origins: Main origin is the s3, and fallback is the Lambda. Use fallback response codes [403, 500, 503, 504]

When you are ready for production, create a new CloudFron behavior for every image extension you want to optimze, with the following caracteristics:
* path pattern = image extension (e.g. *.jpg)
* origin = created origin group
* CloudFront Function on viewer event = the created CloudFront Function name


## License

This library is licensed under the MIT-0 License. See the LICENSE file.

