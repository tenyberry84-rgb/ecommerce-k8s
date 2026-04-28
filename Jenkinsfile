pipeline {
    agent any

    environment {
        DOCKER_USER = 'tenyberry'
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Branch: ${env.GIT_BRANCH}"
                echo "Commit: ${env.GIT_COMMIT}"
                echo 'Code checked out from GitHub!'
            }
        }

        stage('Build Images') {
            steps {
                echo 'Building Docker images...'
                sh 'docker build -t ${DOCKER_USER}/auth-service:${BUILD_NUMBER} ./services/auth'
                sh 'docker build -t ${DOCKER_USER}/product-service:${BUILD_NUMBER} ./services/product'
                sh 'docker build -t ${DOCKER_USER}/order-service:${BUILD_NUMBER} ./services/order'
                sh 'docker build -t ${DOCKER_USER}/frontend-service:${BUILD_NUMBER} ./services/frontend'
                echo 'All images built!'
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-hub-creds',
                    usernameVariable: 'DOCKER_USERNAME',
                    passwordVariable: 'DOCKER_PASSWORD'
                )]) {
                    sh 'echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin'
                    sh 'docker push ${DOCKER_USER}/auth-service:${BUILD_NUMBER}'
                    sh 'docker push ${DOCKER_USER}/product-service:${BUILD_NUMBER}'
                    sh 'docker push ${DOCKER_USER}/order-service:${BUILD_NUMBER}'
                    sh 'docker push ${DOCKER_USER}/frontend-service:${BUILD_NUMBER}'
                }
                echo 'All images pushed to Docker Hub!'
            }
        }

        stage('Summary') {
            steps {
                echo "=============================="
                echo "Build #${BUILD_NUMBER} complete!"
                echo "Images pushed:"
                echo "  ${DOCKER_USER}/auth-service:${BUILD_NUMBER}"
                echo "  ${DOCKER_USER}/product-service:${BUILD_NUMBER}"
                echo "  ${DOCKER_USER}/order-service:${BUILD_NUMBER}"
                echo "  ${DOCKER_USER}/frontend-service:${BUILD_NUMBER}"
                echo "=============================="
            }
        }
    }

    post {
        success { echo "SUCCESS! Build ${BUILD_NUMBER} done." }
        failure { echo "FAILED! Check logs above." }
    }
}
