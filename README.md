# Next.js Docker AWS Project

This is a Next.js application that runs in a Docker container and is deployed to AWS using CDK.

## Prerequisites

- Node.js 18 or later
- Docker
- AWS CLI configured with appropriate credentials
- AWS CDK CLI

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Docker

Build the Docker image:
```bash
docker build -t nextjs-docker-aws .
```

Run the container locally:
```bash
docker run -p 3000:3000 nextjs-docker-aws
```

## Deployment

1. Install AWS CDK dependencies:
```bash
cd infrastructure
npm install
```

2. Deploy the infrastructure:
```bash
cdk deploy
```

3. Note the ECR repository URI and Load Balancer DNS from the output.

## CI/CD

The project includes a GitHub Actions workflow that:
1. Builds and tests the application
2. Builds the Docker image
3. Pushes the image to ECR
4. Deploys to ECS Fargate

Required GitHub Secrets:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

## Project Structure

- `/app` - Next.js application code
- `/infrastructure` - AWS CDK infrastructure code
- `/.github/workflows` - CI/CD pipeline configuration
- `/public` - Static assets
- `Dockerfile` - Docker configuration
- `next.config.js` - Next.js configuration
