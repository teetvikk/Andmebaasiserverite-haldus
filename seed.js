const mysql = require("mysql2/promise");
const { faker } = require("@faker-js/faker");

faker.seed(123); // fikseeritud seeme reprodutseeritavuseks

// Andmebaasi ühendus
(async () => {
  // Dry-run mode: when enabled we don't connect to DB and only print samples.
  const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

  // Allow overriding counts via environment for quick tests
  const userCount = parseInt(process.env.USER_COUNT, 10) || (DRY_RUN ? 100 : 100_000);
  const schoolCount = parseInt(process.env.SCHOOL_COUNT, 10) || 50;
  const classCount = parseInt(process.env.CLASS_COUNT, 10) || (DRY_RUN ? 50 : 500);
  const assignmentCount = parseInt(process.env.ASSIGNMENT_COUNT, 10) || (DRY_RUN ? 500 : 2_000_000);

  let connection = null;

  // Helper funktsioon partiisisestuseks
  async function insertBatch(table, rows) {
    if (!rows || rows.length === 0) return;
    if (DRY_RUN) {
      // Print only a small sample to verify generated shape
      console.log(`DRY RUN - ${table}: sample ${Math.min(3, rows.length)} rows:`);
      console.dir(rows.slice(0, 3), { depth: 2 });
      return;
    }
    const keys = Object.keys(rows[0]);
    const placeholders = rows.map(() => `(${keys.map(() => "?").join(",")})`).join(",");
    const values = rows.flatMap(row => keys.map(k => row[k]));
    await connection.execute(`INSERT INTO ${table} (${keys.join(",")}) VALUES ${placeholders}`, values);
  }

  try {
    if (!DRY_RUN) {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || "mariadb",
        port: parseInt(process.env.DB_PORT || "3306"),
        user: process.env.DB_USER || "student",
        password: process.env.DB_PASSWORD || "Passw0rd",
        database: process.env.DB_NAME || "tahvel",
      });
    }
    // Users
    const userBatchSize = 5000;
    for (let i = 0; i < userCount; i += userBatchSize) {
      const size = Math.min(userBatchSize, userCount - i);
      const batch = Array.from({ length: size }, (_, idx) => ({
        username: `${faker.internet.userName()}_${i + idx + 1}`,
        email: faker.internet.email(),
        password: faker.internet.password(),
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        role: faker.helpers.arrayElement(["student", "teacher"]),
      }));
      await insertBatch("users", batch);
      if (!DRY_RUN) console.log(`Inserted users: ${i + batch.length}/${userCount}`);
      else console.log(`DRY RUN - users generated: ${i + batch.length}/${userCount}`);
    }

    // Schools
    for (let i = 0; i < schoolCount; i++) {
      await insertBatch("schools", [{
        name: faker.company.name(),
        address: faker.address.streetAddress(),
        city: faker.address.city(),
      }]);
    }

    // Classes
    const classBatchSize = 100;
    for (let i = 0; i < classCount; i += classBatchSize) {
      const size = Math.min(classBatchSize, classCount - i);
      const batch = Array.from({ length: size }, () => ({
        school_id: faker.datatype.number({ min: 1, max: schoolCount }),
        name: faker.lorem.words(2),
        year: faker.datatype.number({ min: 1, max: 12 }),
      }));
      await insertBatch("classes", batch);
    }

    // Subjects
    const subjects = ["Math", "History", "Physics", "Chemistry", "Estonian"];
    for (const name of subjects) {
      await insertBatch("subjects", [{ name }]);
    }

    // Assignments (peamine mitte-lookup tabel ≥ 2M)
    const assignmentBatchSize = 5000;
    for (let i = 0; i < assignmentCount; i += assignmentBatchSize) {
      const size = Math.min(assignmentBatchSize, assignmentCount - i);
      const batch = Array.from({ length: size }, () => ({
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        creator_id: faker.datatype.number({ min: 1, max: userCount }),
        class_id: faker.datatype.number({ min: 1, max: classCount }),
        subject_id: faker.datatype.number({ min: 1, max: subjects.length }),
  due_date: faker.date.future(1).toISOString().slice(0, 19).replace("T", " "),
      }));
      await insertBatch("assignments", batch);
      if (!DRY_RUN && ((i / assignmentBatchSize) % 20 === 0)) console.log(`Inserted assignments: ${i + batch.length}/${assignmentCount}`);
      else if (DRY_RUN && ((i / assignmentBatchSize) % 20 === 0)) console.log(`DRY RUN - assignments generated: ${i + batch.length}/${assignmentCount}`);
    }

    console.log("Seeder valmis! Kõik tabelid on täidetud.");
  } catch (err) {
    console.error("Seeder error:", err);
    throw err;
  } finally {
    if (connection) await connection.end();
  }
})();
