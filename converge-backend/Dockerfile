# Multi-stage Docker build for Converge Spring Boot Backend (Java 21)
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
RUN ./mvnw dependency:go-offline -B

COPY src/ src/
RUN ./mvnw clean package -DskipTests -B

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd -r converge && useradd -r -g converge converge && chown -R converge:converge /app
COPY --from=builder --chown=converge:converge /app/target/converge-backend-0.0.1-SNAPSHOT.jar app.jar
USER converge

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseSerialGC", "-XX:MaxRAMPercentage=75.0", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
