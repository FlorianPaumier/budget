import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

val releasePropertiesFile = file(System.getenv("BUDGET_SIGNING_PROPERTIES") ?: "${System.getProperty("user.home")}/.config/household-budget/signing/release.properties")
val releaseProperties = Properties().apply { if (releasePropertiesFile.exists()) releasePropertiesFile.inputStream().use(::load) }

android {
    namespace = "com.household.budget"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.household.budget"
        minSdk = 26
        targetSdk = 36
        versionCode = providers.gradleProperty("versionCode").orElse("7").get().toInt()
        versionName = providers.gradleProperty("versionName").orElse("0.1.6").get()
    }

    buildFeatures { buildConfig = true }
    signingConfigs {
        if (releasePropertiesFile.exists()) create("householdRelease") {
            storeFile = file(releaseProperties.getProperty("storeFile"))
            storePassword = releaseProperties.getProperty("storePassword")
            keyAlias = releaseProperties.getProperty("keyAlias")
            keyPassword = releaseProperties.getProperty("keyPassword")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (releasePropertiesFile.exists()) signingConfig = signingConfigs.getByName("householdRelease")
        }
    }

    buildFeatures {
        compose = true
    }
    testOptions {
        unitTests.isIncludeAndroidResources = true
        unitTests.all {
            it.jvmArgs("--add-opens=java.base/java.lang=ALL-UNNAMED")
            it.jvmArgs("--add-opens=java.base/java.util=ALL-UNNAMED")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

val syncBackendOpenApi by tasks.registering(Copy::class) {
    val sourceSpec = layout.projectDirectory.file("../../backend/openapi/v1.json")
    from(sourceSpec)
    into(layout.projectDirectory.dir("src/main/assets"))
    rename { "backend-openapi-v1.json" }
    doFirst {
        check(sourceSpec.asFile.isFile) { "Backend OpenAPI specification missing: ${sourceSpec.asFile}" }
    }
}

tasks.named("preBuild") {
    dependsOn(syncBackendOpenApi)
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.04.01")
    implementation(composeBom)
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.navigation:navigation-compose:2.9.5")
    implementation("androidx.room:room-runtime:2.8.5")
    implementation("androidx.room:room-ktx:2.8.5")
    ksp("androidx.room:room-compiler:2.8.5")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.bouncycastle:bcprov-jdk18on:1.86")
    testImplementation("junit:junit:4.13.2")
    testImplementation(composeBom)
    testImplementation("org.robolectric:robolectric:4.16")
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("androidx.work:work-testing:2.11.2")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("org.json:json:20250517")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("com.squareup.okhttp3:okhttp-tls:4.12.0")
}
