import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as customresources from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface ServiceStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  cluster: ecs.ICluster;
  targetGroup: elbv2.IApplicationTargetGroup;
  securityGroup: ec2.ISecurityGroup;
  imageTag?: string;
}

export class ServiceStack extends cdk.Stack {
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    // Add the image tag to the stack description to ensure CDK detects changes
    if (props.imageTag) {
      this.templateOptions.description = `Service stack with image tag: ${props.imageTag}`;
    }

    // Create ECR repository reference
    const repository = ecr.Repository.fromRepositoryName(this, 'NextjsDockerAwsRepository', 'nextjs-docker-aws');

    // Create task execution role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Create task role
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Add ECR permissions to task role
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage'
      ],
      resources: ['*']
    }));

    // Create task definition with consistent family name
    const taskDefinitionFamily = 'nextjs-docker-aws';
    
    console.log(`Creating task definition with family: ${taskDefinitionFamily}`);
    
    // Create task definition with image tag in construct ID to force new revisions
    const taskDefinitionId = props.imageTag 
      ? `TaskDefinition-${props.imageTag.substring(0, 8)}`
      : 'TaskDefinition';
    
    const taskDefinition = new ecs.FargateTaskDefinition(this, taskDefinitionId, {
      family: taskDefinitionFamily,
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    // Add container to task definition with consistent container name
    const imageTag = props.imageTag || 'latest';
    console.log(`Using image tag: ${imageTag}`);
    const container = taskDefinition.addContainer('NextjsContainer', {
      image: ecs.ContainerImage.fromEcrRepository(repository, imageTag),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'nextjs-docker-aws' }),
    });

    container.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Create security group for the service
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    // Allow inbound traffic from the load balancer
    serviceSecurityGroup.addIngressRule(
      props.securityGroup,
      ec2.Port.tcp(3000),
      'Allow inbound traffic from load balancer'
    );

    // Create the ECS service with consistent construct ID
    this.service = new ecs.FargateService(this, 'Service', {
      cluster: props.cluster,
      taskDefinition,
      desiredCount: 1,
      securityGroups: [serviceSecurityGroup],
      assignPublicIp: false,
      enableExecuteCommand: true,
    });

    // Add image tag as a tag to the service to ensure CDK detects changes
    if (props.imageTag) {
      cdk.Tags.of(this.service).add('ImageTag', props.imageTag);
    }

    // Attach service to target group
    this.service.attachToApplicationTargetGroup(props.targetGroup);

    // Add a custom resource to ensure service updates when image tag changes
    if (props.imageTag) {
      new customresources.AwsCustomResource(this, 'ForceServiceUpdate', {
        onCreate: {
          service: 'ECS',
          action: 'updateService',
          parameters: {
            cluster: props.cluster.clusterName,
            service: this.service.serviceName,
            forceNewDeployment: true,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(`force-update-${props.imageTag}`),
        },
        onUpdate: {
          service: 'ECS',
          action: 'updateService',
          parameters: {
            cluster: props.cluster.clusterName,
            service: this.service.serviceName,
            forceNewDeployment: true,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(`force-update-${props.imageTag}`),
        },
        policy: customresources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ecs:UpdateService', 'ecs:DescribeServices'],
            resources: [this.service.serviceArn],
          }),
        ]),
      });
    }

    // Output the service name
    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.service.serviceName,
    });
  }
} 