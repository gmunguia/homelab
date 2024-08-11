#!/bin/bash

set -e

GIT_HASH=$(git rev-parse --short HEAD)

echo "Building Docker images"
docker-compose build --pull

echo "Pushing Docker images with tag: $GIT_HASH"
for service in $(docker-compose config --services); do
	image=$(docker-compose config | grep "image:" | grep "$service" | awk '{print $2}')
	docker tag "$image:latest" "$image:$GIT_HASH"
	docker push "$image:$GIT_HASH"
done

echo "Updating Docker Swarm stack"
STACK_NAME="gitops"
docker stack deploy -c docker-compose.yml $STACK_NAME

echo "Deployment completed successfully!"
