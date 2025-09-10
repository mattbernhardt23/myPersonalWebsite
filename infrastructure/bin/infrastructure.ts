#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import { ServiceStack } from '../lib/service-stack';

const app = new cdk.App();

// Create a temporary stack for VPC lookup
const vpcStack = new cdk.Stack(app, 'VpcLookupStack', {
  env: { account: '761018876037', region: 'us-east-2' }
});

// Reference existing VPC by ID
const vpc = ec2.Vpc.fromVpcAttributes(vpcStack, 'NextjsDockerAwsVpc', {
  vpcId: 'vpc-09dc005f6e52cf6c2',
  availabilityZones: ['us-east-2a', 'us-east-2b'],
  publicSubnetIds: ['subnet-03017b701f219d010', 'subnet-00c31cb56fe033437'],
  privateSubnetIds: ['subnet-0c31168a69f07a10a', 'subnet-08e5e69073e288695']
});

// Create infrastructure stack
const infrastructureStack = new InfrastructureStack(app, 'NextjsDockerAwsStack', {
  env: { account: '761018876037', region: 'us-east-2' },
  vpc: vpc,
});

// Create service stack
const imageTag = app.node.tryGetContext('imageTag');
console.log(`CDK Context imageTag: ${imageTag}`);
const serviceStack = new ServiceStack(app, 'NextjsDockerAwsServiceStack', {
  env: { account: '761018876037', region: 'us-east-2' },
  vpc: vpc,
  cluster: infrastructureStack.cluster,
  targetGroup: infrastructureStack.targetGroup,
  securityGroup: infrastructureStack.securityGroup,
  imageTag: imageTag,
});

app.synth();