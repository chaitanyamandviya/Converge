# Multi-stage Docker build for Converge Backend (Java 21) from repository root
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app/converge-backend

COPY converge-backend/.mvn/ .mvn/
COPY converge-backend/mvnw converge-backend/pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
RUN ./mvnw dependency:go-offline -B

COPY converge-backend/src/ src/
RUN ./mvnw clean package -DskipTests -B

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd -r converge && useradd -r -g converge converge && chown -R converge:converge /app
COPY --from=builder --chown=converge:converge /app/converge-backend/target/converge-backend-0.0.1-SNAPSHOT.jar app.jar
USER converge

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseSerialGC", "-XX:MaxRAMPercentage=75.0", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
