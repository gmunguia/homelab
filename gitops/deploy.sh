#!/bin/bash

set -e

STACK_NAME="gitops"
COMPOSE_FILE="docker-compose.yml"
SERVICES=("webhook" "tunnel")

if ! command -v yq &>/dev/null; then
	echo "yq is not installed. Please install it to proceed."
	echo "See https://github.com/mikefarah/yq#install"
	exit 1
fi

get_image_name() {
	local service=$1
  local remove_image_tag='s/(.+):.+/\1/'
	yq e ".services.$service.image" $COMPOSE_FILE | sed -E $remove_image_tag
}

IMAGE_TAG=$(git rev-parse --short HEAD)

echo "Building Docker images with tag: $IMAGE_TAG"
for service in "${SERVICES[@]}"; do
	echo "Building $service"
	image_name=$(get_image_name "$service")
	docker build -t "$image_name:latest" -t "$image_name:$IMAGE_TAG" "$service"
done

echo "Pushing Docker images"
for service in "${SERVICES[@]}"; do
	echo "Pushing $service"
	image_name=$(get_image_name "$service")
	docker push "$image_name:latest"
	docker push "$image_name:$IMAGE_TAG"
done

echo "Updating Docker Swarm stack"
export IMAGE_TAG
docker stack deploy --prune --with-registry-auth -c $COMPOSE_FILE $STACK_NAME

echo "Deployment completed successfully!"
