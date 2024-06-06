// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Fn, Stack, StackProps, RemovalPolicy, aws_s3 as s3, aws_s3_deployment as s3deploy, aws_cloudfront as cloudfront, aws_cloudfront_origins as origins, aws_lambda as lambda, aws_iam as iam, Duration, CfnOutput, aws_logs as logs } from 'aws-cdk-lib';
import { CfnDistribution } from "aws-cdk-lib/aws-cloudfront";
import { Construct } from 'constructs';

// Stack Parameters


// Parameters of transformed images
var S3_TRANSFORMED_IMAGE_EXPIRATION_DURATION = '90';
var S3_TRANSFORMED_IMAGE_CACHE_TTL = 'max-age=31622400';
// Max image size in bytes. Bigger images are generated, stored on S3
// and request is redirect to the generated image. Otherwise, an application error is sent.
var MAX_IMAGE_SIZE = '4700000';
// Lambda Parameters
var LAMBDA_MEMORY = '1500';
var LAMBDA_TIMEOUT = '60';



export class ImageOptimizationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const IMAGE_DOMAIN_NAME = this.node.tryGetContext('IMAGE_DOMAIN_NAME');
    if (!IMAGE_DOMAIN_NAME) throw Error ('provide the domain name of image source, -c IMAGE_DOMAIN_NAME=images.example.com');

    var transformedImageBucket = new s3.Bucket(this, 's3-transformed-image-bucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: Duration.days(parseInt(S3_TRANSFORMED_IMAGE_EXPIRATION_DURATION)),
        },
      ],
    });
    
    // Create Lambda for image processing
    var lambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('functions/image-processing'),
      timeout: Duration.seconds(parseInt(LAMBDA_TIMEOUT)),
      memorySize: parseInt(LAMBDA_MEMORY),
      environment: {
        originalImageDomainName: IMAGE_DOMAIN_NAME,
        transformedImageCacheTTL: S3_TRANSFORMED_IMAGE_CACHE_TTL,
        maxImageSize: MAX_IMAGE_SIZE,
        transformedImageBucketName: transformedImageBucket.bucketName
      },
      logRetention: logs.RetentionDays.ONE_DAY,
    };

    var imageProcessing = new lambda.Function(this, 'image-optimization', lambdaProps);

    // statements of the IAM policy to attach to Lambda
    var iamPolicyStatements = [new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: ['arn:aws:s3:::' + transformedImageBucket.bucketName + '/*'],
    })];
     // attach iam policy to the role assumed by Lambda
    imageProcessing.role?.attachInlinePolicy(
      new iam.Policy(this, 'read-write-bucket-policy', {
        statements: iamPolicyStatements,
      }),
    );

    // Enable Lambda URL
    const imageProcessingURL = imageProcessing.addFunctionUrl();

    // Leverage CDK Intrinsics to get the hostname of the Lambda URL 
    const imageProcessingDomainName = Fn.parseDomainName(imageProcessingURL.url);

    // Create a CloudFront origin: S3 with fallback to Lambda when image needs to be transformed, otherwise with Lambda as sole origin
    var imageOrigin;


    // Create a CloudFront Function for url rewrites
    const urlRewriteFunction = new cloudfront.Function(this, 'urlRewrite', {
      code: cloudfront.FunctionCode.fromFile({ filePath: 'functions/url-rewrite/index.js', }),
      functionName: `urlRewriteFunction-${this.node.addr}`,
    });

    new CfnOutput(this, 'LambdaURL', {
      description: 'Domain name of LambdaURL',
      value: imageProcessingDomainName
    });

    new CfnOutput(this, 'S3 bucket', {
      description: 'created to store generated images',
      value: transformedImageBucket.bucketName
    });

    new CfnOutput(this, 'CloudFront Function', {
      description: 'name of the created CloudFront Function',
      value: `urlRewriteFunction-${this.node.addr}`
    });
  }
}
