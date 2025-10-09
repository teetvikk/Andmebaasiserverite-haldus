const mysql = require("mysql2/promise");
const { faker } = require("@faker-js/faker");

faker.seed(123); // fikseeritud seeme reprodutseeritavuseks

// Andmebaasi ühendus
(async () => {
  // Dry-run mode: when enabled we don't connect to DB and only print samples.
  const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

  // Insert mode: 'normal' | 'ignore'
  // 'ignore' will use INSERT IGNORE to skip rows that would violate unique constraints.
  const INSERT_MODE = process.env.DB_INSERT_MODE || 'ignore';

  // Allow overriding counts via environment for quick tests
  const userCount = parseInt(process.env.USER_COUNT, 10) || (DRY_RUN ? 100 : 100_000);
  const schoolCount = parseInt(process.env.SCHOOL_COUNT, 10) || 50;
  const classCount = parseInt(process.env.CLASS_COUNT, 10) || (DRY_RUN ? 50 : 500);
  const assignmentCount = parseInt(process.env.ASSIGNMENT_COUNT, 10) || (DRY_RUN ? 500 : 2_000_000);

  let connection = null;

  // small helper to normalise strings for deterministic unique fields (emails/usernames)
  function slugify(s) {
    if (!s) return '';
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 60);
  }

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
    const columns = keys.map(k => `\`${k}\``).join(",");
    const verb = INSERT_MODE === 'ignore' ? 'INSERT IGNORE' : 'INSERT';
    const sql = `${verb} INTO \`${table}\` (${columns}) VALUES ${placeholders}`;
    await connection.execute(sql, values);
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
    // We ensure deterministic, unique usernames and emails by including a sequential index in them.
    const userBatchSize = 5000;
    for (let i = 0; i < userCount; i += userBatchSize) {
      const size = Math.min(userBatchSize, userCount - i);
      const batch = Array.from({ length: size }, (_, idx) => {
        const globalIndex = i + idx + 1;
        const first_name = faker.name.firstName();
        const last_name = faker.name.lastName();
        const baseUsername = slugify(faker.internet.userName()) || `${slugify(first_name)}${slugify(last_name)}`;
        const username = `${baseUsername}_${globalIndex}`;
        // deterministic unique email to avoid accidental duplicates
        const email = `${slugify(first_name)}.${slugify(last_name)}.${globalIndex}@example.org`;
        return {
          username,
          email,
          password: faker.internet.password(),
          first_name,
          last_name,
          role: faker.helpers.arrayElement(["student", "teacher"]),
        };
      });
      await insertBatch("users", batch);
      if (!DRY_RUN) console.log(`Inserted users: ${i + batch.length}/${userCount}`);
      else console.log(`DRY RUN - users generated: ${i + batch.length}/${userCount}`);
    }

    // Schools
    // Make school names deterministic/unique by appending an index.
    for (let i = 0; i < schoolCount; i++) {
      const idx = i + 1;
      await insertBatch("schools", [{
        name: `${faker.company.name()} ${idx}`,
        address: faker.address.streetAddress(),
        city: faker.address.city(),
      }]);
    }

    // Classes
    const classBatchSize = 100;
    for (let i = 0; i < classCount; i += classBatchSize) {
      const size = Math.min(classBatchSize, classCount - i);
      const batch = Array.from({ length: size }, (_, idx) => {
        const globalIndex = i + idx + 1;
        const school_id = faker.datatype.number({ min: 1, max: schoolCount });
        const year = faker.datatype.number({ min: 1, max: 12 });
        // ensure class names are distinguishable and unlikely to collide
        const name = `Class-${school_id}-${year}-${globalIndex}`;
        return {
          school_id,
          name,
          year,
        };
      });
      await insertBatch("classes", batch);
    }

    // Subjects
    const subjects = ["Math", "History", "Physics", "Chemistry", "Estonian"];
    for (const name of subjects) {
      await insertBatch("subjects", [{ name }]);
    }

    // Assignments (peamine mitte-lookup tabel ≥ 2M)
    // We add an index suffix to titles so accidental duplicates are extremely unlikely.
    const assignmentBatchSize = 5000;
    for (let i = 0; i < assignmentCount; i += assignmentBatchSize) {
      const size = Math.min(assignmentBatchSize, assignmentCount - i);
      const batch = Array.from({ length: size }, (_, idx) => {
        const globalIndex = i + idx + 1;
        return {
          title: `${faker.lorem.sentence().replace(/\n/g, ' ')} #${globalIndex}`,
          description: faker.lorem.paragraph(),
          creator_id: faker.datatype.number({ min: 1, max: userCount }),
          class_id: faker.datatype.number({ min: 1, max: classCount }),
          subject_id: faker.datatype.number({ min: 1, max: subjects.length }),
          due_date: faker.date.future(1).toISOString().slice(0, 19).replace("T", " "),
        };
      });
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
