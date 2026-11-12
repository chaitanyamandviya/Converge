# Multi-stage Docker build for Converge Spring Boot Backend (Java 25)
FROM eclipse-temurin:25-jdk AS builder
WORKDIR /app

# Copy Maven wrapper & pom.xml first for layer caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw
RUN ./mvnw dependency:go-offline -B

# Copy source and build jar
COPY src/ src/
RUN ./mvnw clean package -DskipTests -B

# Minimal runtime image
FROM eclipse-temurin:25-jre
WORKDIR /app

# Run as non-root user for production security
RUN groupadd -r converge && useradd -r -g converge converge
USER converge

# Copy compiled jar from builder stage
COPY --from=builder /app/target/converge-backend-0.0.1-SNAPSHOT.jar app.jar

# Render provides $PORT dynamically
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseSerialGC", "-XX:MaxRAMPercentage=75.0", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
