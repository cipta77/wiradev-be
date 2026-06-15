-- MySQL Database Schema Initialization
-- Automatically loaded on first Docker container startup

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash TEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    university VARCHAR(255),
    field_of_study VARCHAR(255),
    graduation_year INT,
    avatar_url TEXT,
    achievement_goal ENUM('GET_FIRST_JOB', 'SWITCH_DEVELOPER_ROLE', 'IMPROVE_CODING_SKILLS', 'PREPARE_INTERVIEWS', 'BUILD_PORTFOLIO', 'UNDERSTAND_MARKET'),
    target_role VARCHAR(255),
    cv_url VARCHAR(255),
    transcript_url VARCHAR(255),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    readiness_score DECIMAL(5,2) DEFAULT 0.00,
    github_username VARCHAR(255) NULL,
    github_languages JSON NULL,
    github_readiness_score DECIMAL(5,2) NULL,
    github_last_synced_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_providers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_provider (provider, provider_user_id),
    CONSTRAINT fk_auth_providers_users 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessment_categories (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    category_id VARCHAR(36) NOT NULL,
    question_type ENUM('multiple_choice', 'yes_no') NOT NULL,
    question_text TEXT NOT NULL,
    options JSON,
    correct_answer VARCHAR(10) NOT NULL,
    explanation TEXT,
    difficulty ENUM('easy','medium','hard') DEFAULT 'medium',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_aq_category FOREIGN KEY (category_id) 
        REFERENCES assessment_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role_category_mapping (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    target_role_pattern VARCHAR(255) NOT NULL,
    category_slug VARCHAR(100) NOT NULL,
    priority INT DEFAULT 0,
    UNIQUE KEY uniq_role_cat (target_role_pattern, category_slug)
);

CREATE TABLE IF NOT EXISTS user_assessments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    time_taken_seconds INT NULL,
    total_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    score_percentage DECIMAL(5,2) DEFAULT 0,
    CONSTRAINT fk_ua_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_assessment_answers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    assessment_id VARCHAR(36) NOT NULL,
    question_id VARCHAR(36) NOT NULL,
    user_answer VARCHAR(10) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_uaa_assessment FOREIGN KEY (assessment_id)
        REFERENCES user_assessments(id) ON DELETE CASCADE,
    CONSTRAINT fk_uaa_question FOREIGN KEY (question_id)
        REFERENCES assessment_questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cv_screenings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    overall_score INT NOT NULL DEFAULT 0,
    strengths JSON,
    weaknesses JSON,
    ai_summary TEXT,
    recommendations JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cv_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transcript_screenings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    overall_score INT NOT NULL DEFAULT 0,
    strengths JSON,
    weaknesses JSON,
    ai_summary TEXT,
    recommendations JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transcript_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    type ENUM('recruiter', 'salary') NOT NULL,
    company_name VARCHAR(100),
    status ENUM('ongoing', 'completed') DEFAULT 'ongoing',
    current_question_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sim_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulation_messages (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    simulation_id VARCHAR(36) NOT NULL,
    sender ENUM('bot', 'user') NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_sim FOREIGN KEY (simulation_id) 
        REFERENCES simulations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulation_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    simulation_id VARCHAR(36) NOT NULL UNIQUE,
    is_passed BOOLEAN NOT NULL DEFAULT FALSE,
    score INT NOT NULL DEFAULT 0,
    feedback TEXT NOT NULL,
    negotiated_salary VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_res_sim FOREIGN KEY (simulation_id) 
        REFERENCES simulations(id) ON DELETE CASCADE
);

-- ==========================================
-- PRE-SEED DATA
-- ==========================================

-- Pre-seed Categories
INSERT IGNORE INTO assessment_categories (id, slug, name, description, icon, color) VALUES
('cat-fe', 'frontend', 'Frontend Development', 'Assess user interface, accessibility, framework, styling, and client performance.', 'Layout', 'blue'),
('cat-be', 'backend', 'Backend Development', 'Assess database, system design, runtime engines, caching, and server routing.', 'Database', 'purple'),
('cat-ds', 'data_science', 'Data Science & AI', 'Assess data pipelines, mathematical algorithms, statistical insights, and machine learning.', 'Layers', 'emerald'),
('cat-cs', 'general_cs', 'Problem Solving & CS', 'Assess algorithms, complexity analysis, data structures, and computer science basics.', 'Code2', 'orange'),
('cat-ss', 'soft_skills', 'Productivity & Collaboration', 'Assess team collaboration, Git architectures, agile values, and communication.', 'Zap', 'blue'),
('cat-ot', 'other', 'General Knowledge', 'Assess general IT concepts, standard workflows, and product design principles.', 'BookOpen', 'purple'),
('cat-dv', 'devops', 'Cloud & DevOps', 'Assess containerization, CI/CD pipelines, cloud orchestration, and infrastructure as code.', 'Cloud', 'blue'),
('cat-sc', 'security', 'Cybersecurity', 'Assess secure coding, authentication mechanisms, encryption protocols, and common vulnerability mitigation.', 'Shield', 'purple'),
('cat-mb', 'mobile', 'Mobile Development', 'Assess responsive layouts, PWA characteristics, mobile-first optimization, and native integration.', 'Smartphone', 'emerald'),
('cat-db', 'database', 'Database Engineering', 'Assess relational schemas, non-relational storage, index profiling, transaction isolation, and query optimization.', 'HardDrive', 'orange');

-- Pre-seed Role Mapping
INSERT IGNORE INTO role_category_mapping (id, target_role_pattern, category_slug, priority) VALUES
-- Frontend Developer Mappings
(UUID(), 'Frontend Developer', 'frontend', 1),
(UUID(), 'Frontend Developer', 'general_cs', 2),
(UUID(), 'Frontend Developer', 'soft_skills', 3),
(UUID(), 'Frontend Developer', 'mobile', 4),
(UUID(), 'Frontend Developer', 'database', 5),
(UUID(), 'Frontend Developer', 'security', 6),
(UUID(), 'Frontend Developer', 'devops', 7),
(UUID(), 'Frontend Developer', 'backend', 8),
(UUID(), 'Frontend Developer', 'data_science', 9),
(UUID(), 'Frontend Developer', 'other', 10),

-- Backend Developer Mappings
(UUID(), 'Backend Developer', 'backend', 1),
(UUID(), 'Backend Developer', 'database', 2),
(UUID(), 'Backend Developer', 'general_cs', 3),
(UUID(), 'Backend Developer', 'security', 4),
(UUID(), 'Backend Developer', 'devops', 5),
(UUID(), 'Backend Developer', 'soft_skills', 6),
(UUID(), 'Backend Developer', 'frontend', 7),
(UUID(), 'Backend Developer', 'mobile', 8),
(UUID(), 'Backend Developer', 'data_science', 9),
(UUID(), 'Backend Developer', 'other', 10),

-- Data Scientist Mappings
(UUID(), 'Data Scientist', 'data_science', 1),
(UUID(), 'Data Scientist', 'general_cs', 2),
(UUID(), 'Data Scientist', 'database', 3),
(UUID(), 'Data Scientist', 'backend', 4),
(UUID(), 'Data Scientist', 'soft_skills', 5),
(UUID(), 'Data Scientist', 'security', 6),
(UUID(), 'Data Scientist', 'frontend', 7),
(UUID(), 'Data Scientist', 'devops', 8),
(UUID(), 'Data Scientist', 'mobile', 9),
(UUID(), 'Data Scientist', 'other', 10),

-- UI/UX Designer Mappings
(UUID(), 'UI/UX Designer', 'frontend', 1),
(UUID(), 'UI/UX Designer', 'mobile', 2),
(UUID(), 'UI/UX Designer', 'soft_skills', 3),
(UUID(), 'UI/UX Designer', 'other', 4),
(UUID(), 'UI/UX Designer', 'general_cs', 5),
(UUID(), 'UI/UX Designer', 'database', 6),
(UUID(), 'UI/UX Designer', 'security', 7),
(UUID(), 'UI/UX Designer', 'backend', 8),
(UUID(), 'UI/UX Designer', 'devops', 9),
(UUID(), 'UI/UX Designer', 'data_science', 10),

-- Freelance Mappings
(UUID(), 'Freelance', 'general_cs', 1),
(UUID(), 'Freelance', 'soft_skills', 2),
(UUID(), 'Freelance', 'other', 3),
(UUID(), 'Freelance', 'frontend', 4),
(UUID(), 'Freelance', 'backend', 5),
(UUID(), 'Freelance', 'database', 6),
(UUID(), 'Freelance', 'mobile', 7),
(UUID(), 'Freelance', 'security', 8),
(UUID(), 'Freelance', 'devops', 9),
(UUID(), 'Freelance', 'data_science', 10);

-- Seed Assessment Questions
-- Frontend MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-fe-1', 'cat-fe', 'multiple_choice', 'In JavaScript, which of the following represents the correct evaluation of typeof null?', '[{"id":"A","text":"\\"null\\""},{"id":"B","text":"\\"object\\""},{"id":"C","text":"\\"undefined\\""},{"id":"D","text":"\\"function\\""}]', 'B', 'Historically in JavaScript, null is represented as a null pointer, which maps to type code 0 for objects, making typeof null evaluate to "object".'),
('q-fe-2', 'cat-fe', 'multiple_choice', 'Which React hook is specifically optimized for memoizing computed values across render runs without invoking them on each render?', '[{"id":"A","text":"useEffect"},{"id":"B","text":"useCallback"},{"id":"C","text":"useMemo"},{"id":"D","text":"useRef"}]', 'C', 'useMemo returns a memoized value, recomputing it only when one of its dependency variables has changed.'),
('q-fe-3', 'cat-fe', 'multiple_choice', 'When designing for WCAG 2.1 AA level conformance, what is the minimum required color contrast ratio for standard size body text?', '[{"id":"A","text":"3.0:1"},{"id":"B","text":"4.5:1"},{"id":"C","text":"7.0:1"},{"id":"D","text":"2.1:1"}]', 'B', 'WCAG 2.1 AA level requires a contrast ratio of at least 4.5:1 for normal text (under 18pt or 14pt bold).'),
('q-fe-4', 'cat-fe', 'yes_no', 'Do you routinely utilize semantic HTML tags such as <main>, <article>, and <section> instead of relying purely on generic <div> tags to ensure search indexing and screen reader optimization?', NULL, 'yes', 'Using semantic HTML guarantees native accessibility and structures standard DOM trees efficiently.'),
('q-fe-5', 'cat-fe', 'yes_no', 'Have you actively configured CSS variables or Tailwind CSS custom extensions to support a functional, responsive dark mode in a shipped production application?', NULL, 'yes', 'Responsive styles with custom styling frameworks or CSS variables are critical to providing optimized system theme integration.');

-- Backend MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-be-1', 'cat-be', 'multiple_choice', 'Which HTTP status code is most appropriate to return when a client makes a POST request that creates a new database resource successfully?', '[{"id":"A","text":"200 OK"},{"id":"B","text":"201 Created"},{"id":"C","text":"202 Accepted"},{"id":"D","text":"204 No Content"}]', 'B', '201 Created is the specific response code indicating that the request succeeded and resulted in a resource being newly created.'),
('q-be-2', 'cat-be', 'multiple_choice', 'Which of the following database structures is specifically optimized to perform lightning-fast range queries on ordered data records?', '[{"id":"A","text":"Hash Index"},{"id":"B","text":"B-Tree Index"},{"id":"C","text":"Adjacency List"},{"id":"D","text":"Inverted Index"}]', 'B', 'B-Trees keep data sorted and allow logarithmic searches, insertions, and range operations.'),
('q-be-3', 'cat-be', 'multiple_choice', 'When mitigating SQL Injection vulnerabilities, which of the following strategies is universally considered the most effective code-level defense?', '[{"id":"A","text":"Client-side input validation"},{"id":"B","text":"Replacing all single quotes with double quotes"},{"id":"C","text":"Using parameterized queries (prepared statements)"},{"id":"D","text":"Encoding output HTML strings"}]', 'C', 'Prepared statements separate query logic from variable parameters, neutralizing malicious code strings.'),
('q-be-4', 'cat-be', 'yes_no', 'Have you designed, set up, and successfully queried an indexed database partition or a custom caching strategy (e.g. using Redis) to solve severe performance bottlenecks?', NULL, 'yes', 'Caching hot reads with Redis or optimizing relational indices directly reduces CPU load and request latencies.'),
('q-be-5', 'cat-be', 'yes_no', 'Have you configured and implemented a robust JSON Web Token (JWT) stateless auth system featuring dynamic token validation via standard HTTP header parsing?', NULL, 'yes', 'Robust token parsing is fundamental to modern stateless API gateway validation and authorization.');

-- Data Science MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-ds-1', 'cat-ds', 'multiple_choice', 'When preparing structured tables, which technique is most appropriate for converting categorical text columns into numerical features for model training?', '[{"id":"A","text":"Min-Max Scaling"},{"id":"B","text":"One-Hot Encoding"},{"id":"C","text":"Log Transformation"},{"id":"D","text":"Z-Score Normalization"}]', 'B', 'One-Hot Encoding converts categorical variables into multi-column binary flags suitable for algorithms.'),
('q-ds-2', 'cat-ds', 'multiple_choice', 'Which library in Python is universally standard for performing numerical operations and multidimensional array manipulations?', '[{"id":"A","text":"Pandas"},{"id":"B","text":"Numpy"},{"id":"C","text":"Matplotlib"},{"id":"D","text":"BeautifulSoup"}]', 'B', 'NumPy is the foundational scientific computing library providing highly optimized C-backed array processing capabilities.'),
('q-ds-3', 'cat-ds', 'multiple_choice', 'What phenomenon occurs when a model learns training data noise perfectly, resulting in extremely high accuracy on train data but poor predictions on test data?', '[{"id":"A","text":"Underfitting"},{"id":"B","text":"Bias-Variance Equilibrium"},{"id":"C","text":"Overfitting"},{"id":"D","text":"Covariate Shift"}]', 'C', 'Overfitting happens when a complex model maps training observations too closely, losing generalizability to unseen samples.'),
('q-ds-4', 'cat-ds', 'yes_no', 'Have you actively handled missing datasets by analyzing patterns and implementing advanced imputation techniques like median/mode replacement or KNN imputation?', NULL, 'yes', 'Data preprocessing and strategic imputation prevent training bias and retain database records.'),
('q-ds-5', 'cat-ds', 'yes_no', 'Have you deployed or integrated a Machine Learning model through an endpoint using tools like Flask, FastAPI, or cloud-based serverless environments?', NULL, 'yes', 'Deploying model endpoints exposes predictions securely to client applications.');

-- Problem Solving & CS MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-cs-1', 'cat-cs', 'multiple_choice', 'What is the optimal average-case time complexity of retrieving a specific key-value pair from a highly optimized hash map?', '[{"id":"A","text":"O(1)"},{"id":"B","text":"O(log n)"},{"id":"C","text":"O(n)"},{"id":"D","text":"O(n log n)"}]', 'A', 'Retrieving key elements by hashing maps values to buckets in constant average time O(1).'),
('q-cs-2', 'cat-cs', 'multiple_choice', 'Which sorting algorithm guarantees a consistent worst-case performance of O(n log n) by partitioning and recombining subarrays recursively?', '[{"id":"A","text":"Bubble Sort"},{"id":"B","text":"Quick Sort"},{"id":"C","text":"Merge Sort"},{"id":"D","text":"Insertion Sort"}]', 'C', 'Merge Sort splits subarrays and merges them, ensuring reliable O(n log n) comparisons under any scenario.'),
('q-cs-3', 'cat-cs', 'multiple_choice', 'Which data structure follows the First-In, First-Out (FIFO) access paradigm?', '[{"id":"A","text":"Stack"},{"id":"B","text":"Queue"},{"id":"C","text":"Binary Search Tree"},{"id":"D","text":"Graph"}]', 'B', 'Queues enqueue elements at the back and dequeue from the front, fulfilling the strict FIFO contract.'),
('q-cs-4', 'cat-cs', 'yes_no', 'Can you confidently write recursive operations and evaluate their space complexity impact on the application call stack?', NULL, 'yes', 'Understanding runtime execution call stacks prevents out-of-memory errors and optimization faults.'),
('q-cs-5', 'cat-cs', 'yes_no', 'Have you actively optimized nested loops in production code to lower average algorithm complexity from O(n^2) down to linear or logarithmic time?', NULL, 'yes', 'Reducing nested lookups by leveraging set tracking or sorting significantly improves client processing speeds.');

-- Soft Skills MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-ss-1', 'cat-ss', 'multiple_choice', 'Which Git command is most appropriate when you wish to apply the exact commits of another branch directly onto your current active branch?', '[{"id":"A","text":"git merge"},{"id":"B","text":"git rebase"},{"id":"C","text":"git cherry-pick"},{"id":"D","text":"git pull --rebase"}]', 'C', 'git cherry-pick allows copying individual commits by hash and applying them to the current HEAD.'),
('q-ss-2', 'cat-ss', 'multiple_choice', 'In Agile Scrum frameworks, what is the primary objective of the Daily Standup (Daily Scrum) session?', '[{"id":"A","text":"To showcase detailed features to project stakeholders"},{"id":"B","text":"To sync progress, plan the next 24 hours, and surface blocks"},{"id":"C","text":"To estimate narrative points for subsequent backlog features"},{"id":"D","text":"To review overall team performance and individual code quality"}]', 'B', 'The daily standup aligns team actions toward sprint goals and flags impediments immediately.'),
('q-ss-3', 'cat-ss', 'multiple_choice', 'When encountering a critical merge conflict on a shared repository branch, what is the best first step?', '[{"id":"A","text":"Force push your code changes to overwrite remote code"},{"id":"B","text":"Re-clone the repo in a separate directory and rewrite changes"},{"id":"C","text":"Coordinate with the developers who authored the conflicting lines"},{"id":"D","text":"Delete the conflicting lines from both parts and re-commit"}]', 'C', 'Communicating with co-authors minimizes breaking functionality and ensures precise version merging.'),
('q-ss-4', 'cat-ss', 'yes_no', 'Do you routinely follow a structured branching pattern (such as GitFlow or trunk-based development) and open Pull Requests for peer reviews before merging into main production targets?', NULL, 'yes', 'Enforcing branch policies and peer reviews guarantees stable builds and distributes product context.'),
('q-ss-5', 'cat-ss', 'yes_no', 'Have you actively documented technical specs, architecture decisions (ADRs), or API schemas to assist in onboarding new developers successfully?', NULL, 'yes', 'Documentation and structural records elevate team alignment and accelerate development velocity.');

-- Other MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-ot-1', 'cat-ot', 'multiple_choice', 'Which format is universally standard for serializing object configurations and transferring payload data structures between microservices?', '[{"id":"A","text":"HTML"},{"id":"B","text":"JSON"},{"id":"C","text":"CSV"},{"id":"D","text":"Markdown"}]', 'B', 'JSON (JavaScript Object Notation) is a highly lightweight, human-readable text-based serialization standard.'),
('q-ot-2', 'cat-ot', 'multiple_choice', 'What is the primary goal of creating a wireframe or interactive mockup before starting full production frontend coding?', '[{"id":"A","text":"To optimize performance metrics and web bundle sizes"},{"id":"B","text":"To test backend database query throughput"},{"id":"C","text":"To align layout structure, hierarchy, and UX flows with stakeholders"},{"id":"D","text":"To write modular stylesheet variables early in the lifecycle"}]', 'C', 'Mockups permit quick interactive testing and client review, lowering design modification costs later.'),
('q-ot-3', 'cat-ot', 'multiple_choice', 'Which protocol provides secure, encrypted transfer of web contents over public computer networks?', '[{"id":"A","text":"HTTP"},{"id":"B","text":"FTP"},{"id":"C","text":"HTTPS"},{"id":"D","text":"SMTP"}]', 'C', 'HTTPS encrypts communications using SSL/TLS protocols to prevent sniffing and tampering.'),
('q-ot-4', 'cat-ot', 'yes_no', 'Have you set up automated tooling, task runners, or continuous deployment (CI/CD) pipelines to auto-build and run unit tests on code commits?', NULL, 'yes', 'Automated workflows capture regressions early and reduce manual deployment steps.'),
('q-ot-5', 'cat-ot', 'yes_no', 'Have you proactively used web inspection tooling to audit site load times, track rendering issues, or optimize asset caching structures?', NULL, 'yes', 'Using profiling instruments helps developers target and eliminate rendering lags and heavy resource downloads.');

-- DevOps & Cloud MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-dv-1', 'cat-dv', 'multiple_choice', 'What is the main purpose of using Docker containerization instead of traditional Virtual Machines?', '[{"id":"A","text":"To achieve complete hardware virtualization"},{"id":"B","text":"To run multiple OS kernels simultaneously"},{"id":"C","text":"To package applications with their dependencies in isolated lightweight processes sharing the host OS kernel"},{"id":"D","text":"To speed up internet connection speeds in cloud environments"}]', 'C', 'Docker containers share the host operating system kernel, making them far more lightweight and fast than virtual machines which require a complete hypervisor and guest OS.'),
('q-dv-2', 'cat-dv', 'multiple_choice', 'In a Continuous Integration/Continuous Deployment (CI/CD) pipeline, what is the primary role of a \\"Build\\" stage?', '[{"id":"A","text":"To deploy the code directly to end users"},{"id":"B","text":"To compile code, resolve dependencies, and package artifacts for deployment"},{"id":"C","text":"To write test cases automatically using AI"},{"id":"D","text":"To gather user feedback from social media"}]', 'B', 'The build stage compiles the raw source code, fetches dependencies, and packages the application into deployable assets (e.g. binaries, docker images).'),
('q-dv-3', 'cat-dv', 'multiple_choice', 'Which of the following best describes the concept of \\"Infrastructure as Code\\" (IaC)?', '[{"id":"A","text":"Writing code comments to document server setups"},{"id":"B","text":"Managing and provisioning server infrastructure through machine-readable definition files rather than manual configuration"},{"id":"C","text":"Using CSS styles to design server rooms virtually"},{"id":"D","text":"Running server shell scripts manually on every deployment"}]', 'B', 'IaC allows teams to define and provision cloud resources (like VMs, load balancers, databases) using configuration files (e.g., Terraform, CloudFormation), ensuring repeatable and version-controlled environments.'),
('q-dv-4', 'cat-dv', 'yes_no', 'Do you routinely set up automated health checks and logging aggregators (e.g., Prometheus, ELK stack, or cloud monitoring tools) to actively track service uptime and troubleshoot runtime crashes?', NULL, 'yes', 'Monitoring tools and centralized logs are crucial for quick detection and resolution of production anomalies.'),
('q-dv-5', 'cat-dv', 'yes_no', 'Have you actively written and integrated custom CI/CD pipelines (e.g., GitHub Actions, GitLab CI, or Jenkins) that trigger automated testing suites upon branch updates or pull requests?', NULL, 'yes', 'Automated testing pipelines catch bugs early before they reach production.');

-- Cybersecurity MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-sc-1', 'cat-sc', 'multiple_choice', 'Which hashing algorithm is currently considered highly secure and standard for hashing user passwords before database storage?', '[{"id":"A","text":"MD5"},{"id":"B","text":"SHA-1"},{"id":"C","text":"bcrypt"},{"id":"D","text":"Base64"}]', 'C', 'bcrypt is a slow, salted cryptographic hash function specifically designed to resist brute-force dictionary attacks, unlike legacy algorithms like MD5 or SHA-1.'),
('q-sc-2', 'cat-sc', 'multiple_choice', 'What does the OWASP Top 10 represent in the context of web application security?', '[{"id":"A","text":"The top 10 fastest web frameworks"},{"id":"B","text":"A consensus document representing the most critical security risks to web applications"},{"id":"C","text":"Ten programming languages with the best built-in security features"},{"id":"D","text":"Ten rules for writing clean JavaScript code"}]', 'B', 'The OWASP Top 10 is a widely recognized awareness document highlighting the most critical security vulnerabilities found in web applications.'),
('q-sc-3', 'cat-sc', 'multiple_choice', 'What is the main security purpose of implementing HTTPS instead of standard HTTP?', '[{"id":"A","text":"To speed up site page loading through compression"},{"id":"B","text":"To encrypt communications between client and server, preventing eavesdropping and tampering"},{"id":"C","text":"To prevent users from viewing private HTML source code"},{"id":"D","text":"To automatically validate user email addresses"}]', 'B', 'HTTPS encrypts traffic using SSL/TLS, preventing middle-man attackers from reading or modifying data exchanged between the browser and web servers.'),
('q-sc-4', 'cat-sc', 'yes_no', 'Do you strictly enforce input sanitization and context-aware output encoding to prevent Cross-Site Scripting (XSS) and Injection attacks in code you write?', NULL, 'yes', 'Sanitization and encoding are core coding practices needed to block malicious scripts from running in users'' browsers.'),
('q-sc-5', 'cat-sc', 'yes_no', 'Have you configured multi-factor authentication (MFA) protocols or secure OAuth 2.0 / OpenID Connect authorization flows for user verification in production environments?', NULL, 'yes', 'Implementing industry-standard auth frameworks like OAuth 2.0 ensures secure third-party integration and identity assertions.');

-- Mobile Development MC & Yes/Nopn
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-mb-1', 'cat-mb', 'multiple_choice', 'When designing a responsive web layout, which CSS media query approach is universally recommended for optimization?', '[{"id":"A","text":"Desktop-first, scaling down for mobile devices"},{"id":"B","text":"Mobile-first, using min-width queries to add complexity for larger screens"},{"id":"C","text":"Using absolute pixel heights and widths for all viewport targets"},{"id":"D","text":"Writing separate CSS stylesheets for every brand of smartphone"}]', 'B', 'Mobile-first responsive design builds a lightweight layout for small screens first, using progressive enhancement (`min-width`) to style larger screen sizes.'),
('q-mb-2', 'cat-mb', 'multiple_choice', 'Which of the following is a primary characteristic of a Progressive Web App (PWA)?', '[{"id":"A","text":"It requires a traditional app store download"},{"id":"B","text":"It runs exclusively on desktop operating systems"},{"id":"C","text":"It can work offline by caching assets via Service Workers and can be installed directly on the home screen"},{"id":"D","text":"It completely replaces standard HTML with binary code"}]', 'C', 'PWAs use Service Workers to cache resources for offline availability and manifest files to let users install the web app to their home screens.'),
('q-mb-3', 'cat-mb', 'multiple_choice', 'In mobile viewport design, what is the purpose of the `<meta name="viewport" content="width=device-width, initial-scale=1.0">` tag?', '[{"id":"A","text":"To force the page to render in desktop landscape orientation"},{"id":"B","text":"To instruct the browser to scale the page width to fit the device width, avoiding zoomed-out desktop rendering"},{"id":"C","text":"To download high-resolution mobile retina images automatically"},{"id":"D","text":"To disable zoom options permanently for all users"}]', 'B', 'The viewport meta tag ensures the web browser scales the layout correctly to match the physical width of mobile device screens.'),
('q-mb-4', 'cat-mb', 'yes_no', 'Have you actively integrated touch-friendly gesture events (e.g., swipes, double-taps, pinch-to-zoom) or optimized click-delays for responsive touch elements in mobile web UI?', NULL, 'yes', 'Touch optimization removes delay and enhances intuitive interaction for mobile-first user interfaces.'),
('q-mb-5', 'cat-mb', 'yes_no', 'Have you successfully configured service workers, local caches, or offline synchronization strategies for a web application to function smoothly on spotty mobile networks?', NULL, 'yes', 'Implementing service workers allows seamless offline experiences and fast load times on unreliable network connections.');

-- Database Engineering MC & Yes/No
INSERT IGNORE INTO assessment_questions (id, category_id, question_type, question_text, options, correct_answer, explanation) VALUES
('q-db-1', 'cat-db', 'multiple_choice', 'What does the \"I\" (Isolation) stand for and guarantee in database ACID transaction properties?', '[{"id":"A","text":"Information: Data is fully documented"},{"id":"B","text":"Integration: Tables are connected via foreign keys"},{"id":"C","text":"Isolation: Concurrent transactions run without interfering with each other, preventing dirty reads"},{"id":"D","text":"Increment: Primary keys auto-increment safely"}]', 'C', 'Isolation ensures that concurrent execution of transactions results in a system state that would be obtained if transactions were executed serially.'),
('q-db-2', 'cat-db', 'multiple_choice', 'Which type of database index is best suited for quickly searching through free-text documents or paragraphs for specific words?', '[{"id":"A","text":"B-Tree Index"},{"id":"B","text":"Hash Index"},{"id":"C","text":"Full-Text / Inverted Index"},{"id":"D","text":"Clustered Index"}]', 'C', 'Inverted indexes map terms directly to their document occurrences, which is extremely efficient for full-text search capabilities.'),
('q-db-3', 'cat-db', 'multiple_choice', 'When normalized databases reach the Third Normal Form (3NF), what is the primary benefit achieved?', '[{"id":"A","text":"All columns are encoded in binary for optimal speed"},{"id":"B","text":"Elimination of redundant data and transitive functional dependencies, preventing data modification anomalies"},{"id":"C","text":"The database is split into multiple distributed servers automatically"},{"id":"D","text":"Query execution plans are generated instantly without parsing"}]', 'B', '3NF eliminates redundant information by ensuring every non-key attribute depends strictly on the primary key, avoiding update/insert anomalies.'),
('q-db-4', 'cat-db', 'yes_no', 'Do you routinely analyze slow queries using tools like `EXPLAIN` to identify table scans and create target database indexes accordingly?', NULL, 'yes', 'Using query profilers like `EXPLAIN` shows how the database executes queries, allowing correct indexing to speed up performance.'),
('q-db-5', 'cat-db', 'yes_no', 'Have you designed database schemas featuring complex transactional integrity constraints, foreign keys, or cascading deletes to maintain consistent state across related tables?', NULL, 'yes', 'Schema relational integrity constraints prevent orphaned records and keep database records fully synchronized.');

-- ==========================================
-- MINI PROJECTS TABLES SCHEMA
-- ==========================================

CREATE TABLE IF NOT EXISTS mini_projects (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    brief TEXT NOT NULL,
    level ENUM('Beginner','Intermediate','Advanced') DEFAULT 'Intermediate',
    duration VARCHAR(50),
    tag VARCHAR(100),
    related_skills JSON,
    evaluation_criteria JSON,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mini_project_role_mapping (
    id VARCHAR(36) PRIMARY KEY,
    target_role_pattern VARCHAR(255) NOT NULL,
    mini_project_id VARCHAR(36) NOT NULL,
    priority INT DEFAULT 0,
    UNIQUE KEY uniq_role_proj (target_role_pattern, mini_project_id),
    CONSTRAINT fk_mprm_project FOREIGN KEY (mini_project_id)
        REFERENCES mini_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_mini_project_submissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    mini_project_id VARCHAR(36) NOT NULL,
    status ENUM('not_started','in_progress','submitted','reviewed') DEFAULT 'not_started',
    file_name VARCHAR(255),
    file_url TEXT,
    file_type VARCHAR(50),
    overall_score INT,
    strengths JSON,
    improvements JSON,
    objectives_met JSON,
    ai_summary TEXT,
    submitted_at TIMESTAMP NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_umps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_umps_project FOREIGN KEY (mini_project_id) REFERENCES mini_projects(id) ON DELETE CASCADE
);

-- ==========================================
-- PRE-SEED MINI PROJECTS DATA
-- ==========================================

-- Seed Mini Projects
INSERT IGNORE INTO mini_projects (id, title, description, brief, level, duration, tag, related_skills, evaluation_criteria, sort_order) VALUES
-- Frontend Developer Mini Projects
('mp-fe-1', 'Responsive Portfolio Landing Page', 'Build a modern, mobile-first portfolio landing page demonstrating semantic layout and responsive grid architectures.', 'Rancang dan buat sebuah halaman landing page portofolio profesional yang mobile-first. Halaman ini harus menampilkan profil singkat Anda, keahlian utama, showcase proyek (mock data), dan form kontak.\n\nPersyaratan Teknis:\n1. Gunakan HTML5 semantik (<header>, <main>, <section>, <footer>, <article>).\n2. Gunakan CSS modern (Flexbox dan CSS Grid) untuk tata letak.\n3. Wajib responsif sepenuhnya, diuji di viewport mobile (min-width: 320px) hingga desktop (1200px+).\n4. Terapkan prinsip visual hierarchy yang jelas dengan tipografi yang harmonis.\n5. Optimalkan file aset gambar menggunakan format modern (WebP/SVG).', 'Beginner', '2 hours', 'HTML/CSS', '["HTML5", "CSS3", "Responsive Design", "Mobile-First"]', '["Mobile responsiveness", "Semantic HTML usage", "Modern CSS methodologies (Flexbox/Grid)", "Clean structure"]', 1),

('mp-fe-2', 'React Task Tracker Dashboard', 'Build a highly interactive React task tracker application showcasing complex state management and local persistence.', 'Buat aplikasi dashboard pelacak tugas (Task Tracker) interaktif berbasis React. Aplikasi ini harus memungkinkan pengguna untuk menambah, mengedit, menghapus, menyaring (filter berdasarkan status/prioritas), dan menandai tugas sebagai selesai.\n\nPersyaratan Teknis:\n1. Buat arsitektur komponen React yang modular dan reusable.\n2. Terapkan state management yang efisien (gunakan useState, useReducer, atau useContext jika diperlukan).\n3. Simpan data tugas di Local Storage agar tetap bertahan saat halaman direfresh.\n4. Sediakan fitur filter pencarian real-time.\n5. Tambahkan feedback visual (hover state, transition, empty state) untuk meningkatkan User Experience.', 'Intermediate', '4 hours', 'React', '["React", "State Management", "Local Storage", "Tailwind CSS"]', '["Component modularity", "Efficient state management", "Persistent state using localStorage", "Interactive UI controls"]', 2),

('mp-fe-3', 'Analytics Dashboard with Charts', 'Create a premium data analytics dashboard featuring visual charts, deep filtering, and smooth interactive transitions.', 'Kembangkan sebuah panel instrumen (Analytics Dashboard) interaktif dengan grafik visualisasi data dan integrasi API tiruan (mock API).\n\nPersyaratan Teknis:\n1. Tampilkan minimal 3 jenis grafik menggunakan library charting (seperti Chart.js, Recharts, atau ApexCharts).\n2. Buat sistem filter berdasarkan rentang tanggal dan kategori data.\n3. Integrasikan framer-motion atau transition CSS untuk animasi transisi grafik dan filter data yang mulus.\n4. Terapkan loading skeleton state saat data sedang disimulasikan memuat.\n5. Desain responsif lengkap dengan panel menu navigasi samping (sidebar) yang dapat disembunyikan (collapsible).', 'Advanced', '6 hours', 'React/Next.js', '["Next.js", "API Integration", "Recharts", "Tailwind CSS", "Framer Motion"]', '["Performance & load optimizations", "Smooth UI transitions and animation feedback", "Complex state logic for search and multi-filtering", "Clean API data fetching and error handling"]', 3),

-- Backend Developer Mini Projects
('mp-be-1', 'REST API for Task Management', 'Design and implement a clean, lightweight Express RESTful API with validation and structured error handling.', 'Buatlah sebuah RESTful API yang solid menggunakan Node.js dan Express untuk sistem manajemen tugas (Task Management).\n\nPersyaratan Teknis:\n1. Implementasikan endpoint CRUD lengkap untuk resource Tasks (/api/tasks).\n2. Gunakan konvensi penamaan endpoint RESTful dan HTTP status codes yang tepat (200, 201, 400, 404, 500).\n3. Terapkan request body validation (misal menggunakan Joi atau Zod) untuk memastikan data input valid.\n4. Sediakan middleware penanganan error terpusat (centralized error handling middleware).\n5. Tulis README singkat mengenai instruksi setup dan endpoint documentation.', 'Beginner', '2 hours', 'Node.js/Express', '["Node.js", "Express", "RESTful Routing", "JSON validation"]', '["Standard REST routing conventions", "Proper HTTP status codes & standard error responses", "Basic request body validation", "Middleware organization"]', 1),

('mp-be-2', 'JWT Auth System with Role-based Access', 'Build a secure authentication server featuring JWT tokens, secure password hashing, and authorization controls.', 'Rancang dan buat sistem autentikasi dan otorisasi mandiri (stateless authentication) yang aman menggunakan JSON Web Token (JWT).\n\nPersyaratan Teknis:\n1. Implementasikan fitur registrasi pengguna dengan password yang di-hash menggunakan bcrypt.\n2. Buat endpoint Login yang memvalidasi kredensial dan mengembalikan Token JWT yang aman (HttpOnly cookies sangat direkomendasikan).\n3. Buat middleware otorisasi untuk membatasi akses endpoint berdasarkan peran pengguna (misal: "Admin" vs "User").\n4. Hubungkan dengan database relasional (seperti MySQL atau PostgreSQL) dan gunakan prepared statements untuk mencegah SQL Injection.\n5. Terapkan token expiration dan refresh token mechanism.', 'Intermediate', '4 hours', 'Express/MySQL', '["JWT", "bcryptjs", "MySQL", "Security", "Prepared Statements"]', '["Secure password hashing using bcrypt", "Correct stateless token sign/verify flow", "Role-based authorization middleware", "Database query optimization and security"]', 2),

('mp-be-3', 'Real-time WebSocket Chat Engine', 'Develop an event-driven websocket chat engine with channel rooms, pub/sub architecture, and scale readiness.', 'Bangun backend mesin obrolan real-time (Real-time Chat Engine) yang mendukung beberapa ruangan obrolan (chat rooms) menggunakan WebSockets (Socket.io).\n\nPersyaratan Teknis:\n1. Implementasikan server WebSocket yang menangani koneksi client, join room, mengirim pesan ke room tertentu, dan melacak user yang online.\n2. Integrasikan Redis sebagai pub/sub adapter agar server dapat diskalakan horizontal di masa mendatang (bisa disimulasikan secara lokal).\n3. Simpan riwayat chat ke dalam database untuk dimuat kembali saat user masuk room.\n4. Tangani kasus edge-case seperti pemutusan koneksi yang tidak terduga (unexpected disconnect) dan rekoneksi otomatis.\n5. Amankan koneksi WebSocket menggunakan validasi token JWT pada saat proses handshake.', 'Advanced', '6 hours', 'Node.js/WebSockets', '["WebSockets", "Redis", "Event-driven architecture", "Microservices", "Socket.io"]', '["Robust WebSocket connection handling", "Pub/Sub integration or event emitters", "Scalability considerations", "Graceful reconnection handling"]', 3),

-- Data Scientist Mini Projects
('mp-ds-1', 'House Price Prediction Pipeline', 'Develop an end-to-end regression pipeline starting from messy raw data cleaning to a trained predictor model.', 'Kembangkan pipa pemrosesan data (data pipeline) dan model regresi untuk memprediksi harga rumah berdasarkan berbagai fitur properti.\n\nPersyaratan Teknis:\n1. Lakukan pembersihan data: tangani nilai yang hilang (missing values), outlier, dan duplikasi data menggunakan Pandas.\n2. Lakukan feature engineering: ubah variabel kategorik menjadi numerik (One-Hot Encoding) dan lakukan penskalaan fitur (Scaling/Normalization).\n3. Latih model regresi (misal: Linear Regression atau Decision Tree Regression) menggunakan Scikit-Learn.\n4. Evaluasi model menggunakan metrik standar: R2 Score, Mean Absolute Error (MAE), dan RMSE.\n5. Dokumentasikan seluruh eksperimen dalam Jupyter Notebook yang bersih dengan visualisasi korelasi fitur.', 'Beginner', '3 hours', 'Python/Pandas', '["Python", "Pandas", "Linear Regression", "Data Cleaning"]', '["Handling of missing values and outliers", "Proper feature scaling & encoding", "Model implementation and basic evaluation metrics (R2, RMSE)", "Clear visualization of correlations"]', 1),

('mp-ds-2', 'Customer Churn Classification Model', 'Build a random forest classifier to identify high-risk customer churn with feature importance and class balancing.', 'Bangun model klasifikasi biner untuk memprediksi apakah seorang pelanggan akan berhenti menggunakan layanan (churn) berdasarkan data perilaku mereka.\n\nPersyaratan Teknis:\n1. Analisis ketidakseimbangan kelas (class imbalance) pada dataset dan terapkan teknik penyeimbangan data (seperti SMOTE atau penyesuaian class weights).\n2. Lakukan seleksi fitur penting (Feature Importance) untuk mengidentifikasi faktor utama penyebab churn.\n3. Latih model klasifikasi tingkat lanjut (seperti Random Forest Classifier atau XGBoost).\n4. Evaluasi performa model menggunakan Confusion Matrix, Precision, Recall, F1-Score, dan grafik ROC-AUC.\n5. Buat laporan analisis insight bisnis berdasarkan temuan model.', 'Intermediate', '5 hours', 'Python/Scikit-Learn', '["Python", "Scikit-Learn", "Random Forest", "Feature Engineering", "Imbalance Data"]', '["Detailed feature engineering", "Model selection and comparison", "Use of classification report, confusion matrix, ROC-AUC", "Handling class imbalance"]', 2),

('mp-ds-3', 'Deep Learning Text Classifier', 'Train or fine-tune a BERT-based transformer model for NLP classification task with optimized performance.', 'Bangun model Klasifikasi Teks Deep Learning untuk mendeteksi sentimen atau kategori artikel menggunakan arsitektur Transformer.\n\nPersyaratan Teknis:\n1. Bangun pipeline pemrosesan teks tingkat lanjut (tokenisasi, padding, masking) menggunakan library HuggingFace Transformers.\n2. Lakukan fine-tuning pada model terlatih (seperti BERT atau DistilBERT) menggunakan PyTorch atau TensorFlow.\n3. Terapkan strategi optimasi pelatihan: learning rate scheduling, early stopping, dan gradient clipping.\n4. Evaluasi model pada dataset pengujian dan ukur latensi inferensi rata-rata per sampel.\n5. Rancang antarmuka sederhana (misal menggunakan Streamlit atau Gradio) untuk mendemonstrasikan prediksi real-time model.', 'Advanced', '7 hours', 'Python/PyTorch', '["PyTorch", "NLP", "BERT", "Transformers", "Model Fine-tuning"]', '["Text tokenization and padding pipeline", "Transfer learning implementation", "Training loop optimization", "Inference speed and batching strategy"]', 3),

-- UI/UX Designer Mini Projects
('mp-ui-1', 'Mobile Task Manager Wireframe', 'Create intuitive low-to-mid-fidelity wireframes and task flows for a mobile productivity app.', 'Rancang wireframe low-to-mid fidelity untuk aplikasi seluler manajemen tugas harian yang fokus pada kemudahan penggunaan dan produktivitas.\n\nPersyaratan Teknis:\n1. Petakan user flow utama dari pembuatan tugas baru hingga penandaan tugas selesai.\n2. Rancang tata letak wireframe yang konsisten menggunakan sistem grid yang tepat untuk perangkat mobile.\n3. Terapkan visual hierarchy yang jelas pada teks, tombol, dan elemen navigasi.\n4. Desain layar minimal: Onboarding, Home/Dashboard, Task Detail, dan Create Task.\n5. Buat dokumentasi singkat mengenai keputusan UX dan alasan di balik tata letak yang dipilih.', 'Beginner', '2 hours', 'Figma/Wireframing', '["Figma", "Information Architecture", "UX Flow", "Wireframing"]', '["Clarity of user flow", "Consistent typography and spacing", "Intuitive navigation pattern", "Clear content hierarchy"]', 1),

('mp-ui-2', 'SaaS Dashboard Design System', 'Design a scalable design system for a SaaS application with reusable components and tokens.', 'Buatlah sistem desain (Design System) yang terstruktur dan scalable di Figma untuk aplikasi web SaaS (Software as a Service) Dashboard.\n\nPersyaratan Teknis:\n1. Definisikan palet warna dasar (Primary, Secondary, Neutral, Semantic) yang memenuhi standar aksesibilitas WCAG 2.1 AA.\n2. Buat skala tipografi (Type Scale) yang konsisten untuk berbagai ukuran layar.\n3. Rancang komponen UI atomik yang reusable menggunakan fitur Auto Layout dan Variants di Figma (Tombol, Input Field, Badge, Card, Modal).\n4. Buat panduan dokumentasi penggunaan komponen dan token desain.\n5. Terapkan sistem desain ini pada minimal 2 halaman dashboard contoh.', 'Intermediate', '4 hours', 'Figma/Design Systems', '["Figma", "Design System", "UI Components", "Accessibility", "Auto Layout"]', '["Use of Figma auto-layout and components", "Accessibility compliant color palette (WCAG 2.1)", "Reusable and documented design tokens", "Responsive layout grid variations"]', 2),

('mp-ui-3', 'High-Fidelity Interactive E-wallet', 'Develop a premium, interactive high-fidelity prototype of an e-wallet app with smart micro-interactions.', 'Kembangkan prototipe interaktif high-fidelity untuk aplikasi dompet digital (E-wallet) yang fokus pada visual estetis premium dan animasi transisi yang mulus.\n\nPersyaratan Teknis:\n1. Desain UI visual berkualitas tinggi dengan tema modern (tren glassmorphism, gradien halus, atau tema gelap yang elegan).\n2. Buat micro-interactions yang kaya dan realistis menggunakan fitur Smart Animate di Figma (transisi geser kartu, animasi pemuatan pembayaran, feedback sukses).\n3. Petakan alur lengkap dari transfer uang: pilih kontak, masukkan nominal, konfirmasi PIN, hingga halaman transaksi berhasil/gagal.\n4. Rancang penanganan error state yang estetik saat transaksi gagal.\n5. Pastikan prototipe siap untuk ditunjukkan dalam sesi pengujian kegunaan (usability testing).', 'Advanced', '6 hours', 'Figma/Prototyping', '["Figma", "Interactive Prototyping", "Micro-interactions", "Usability Testing", "UI Design"]', '["Smooth and realistic micro-interactions (smart animate)", "Handling of edge cases", "Comprehensive user testing flows", "Visual aesthetics and design feel"]', 3),

-- Freelance Mini Projects
('mp-fl-1', 'Freelance Business Portfolio Site', 'Build a professional portfolio website layout optimizing copywriting, SEO, and contact generation.', 'Buat halaman portofolio mandiri untuk bisnis freelance Anda yang dioptimalkan untuk menarik calon klien luar negeri.\n\nPersyaratan Teknis:\n1. Tulis copywriting yang memikat, menjelaskan nilai tambah (value proposition) jasa Anda, portofolio proyek sebelumnya, dan testimoni klien.\n2. Rancang struktur layout yang bersih dan responsif menggunakan Tailwind CSS.\n3. Terapkan dasar-dasar SEO: tambahkan meta tags deskripsi, judul halaman yang relevan, serta open graph tags.\n4. Buat form kontak/CTA (Call-to-Action) yang mencolok dan mudah digunakan.\n5. Optimalkan kecepatan muat halaman dengan mengompres gambar dan meminimalkan aset visual.', 'Beginner', '3 hours', 'HTML/Tailwind', '["HTML5", "Tailwind CSS", "Responsive Design", "SEO Basics", "Copywriting"]', '["Professional layout and copywriting", "Fast load speed and asset optimization", "SEO meta tags and title configurations", "Responsive contact form layout"]', 1),

('mp-fl-2', 'Client Project Proposal & SOW Document', 'Create a professional, highly persuasive client project proposal and technical Scope of Work document.', 'Susun sebuah dokumen Proposal Proyek & Scope of Work (SOW) profesional berskala menengah untuk calon klien.\n\nPersyaratan Teknis:\n1. Uraikan pemahaman Anda tentang masalah klien dan solusi teknis yang Anda tawarkan.\n2. Definisikan batasan ruang lingkup proyek secara eksplisit untuk mencegah Scope Creep.\n3. Buat pembagian mileston proyek beserta estimasi waktu pengerjaan yang realistis.\n4. Susun rincian biaya penawaran dengan struktur harga yang transparan (misal: fixed-price atau hourly-rate).\n5. Sajikan dalam format PDF terstruktur rapi dengan tipografi profesional.', 'Intermediate', '4 hours', 'Proposal/Technical Writing', '["Technical Writing", "Project Estimation", "SOW Creation", "Pricing Strategies"]', '["Clear scope definition and deliverables", "Realistic timeline breakdown (Milestones)", "Transparent pricing structure and terms", "Risk analysis and assumptions section"]', 2),

('mp-fl-3', 'Freelance Client Contract & SLA', 'Draft a bulletproof freelance contract and support SLA to safeguard operations and clarify expectations.', 'Rancang draf kontrak kerja freelance (Freelance Contract) dan Perjanjian Tingkat Layanan (SLA) untuk proyek pengembangan web/desain jangka panjang.\n\nPersyaratan Teknis:\n1. Cantumkan pasal kepemilikan Hak Kekayaan Intelektual (IP Intellectual Property) yang jelas setelah pelunasan.\n2. Atur skema pembayaran termin (down-payment, milestone-payment, final-payment) beserta klausul denda keterlambatan.\n3. Buat klausul penanganan perubahan kebutuhan (Change Management) dan penambahan biaya.\n4. Rancang draf SLA yang mencakup waktu respons dukungan (response time), jam kerja operasional, dan batasan pemeliharaan bulanan.\n5. Tulis klausul penghentian kontrak (termination clause) yang adil untuk kedua belah pihak.', 'Advanced', '5 hours', 'Contracts/Operations', '["Legal Writing", "SLA Drafting", "Change Management", "Invoicing terms"]', '["Explicit IP ownership clauses", "Fair payment schedule and late fees policy", "Standard termination clauses", "Detailed support and maintenance service level agreement"]', 3);

-- Seed Mini Project Mappings
INSERT IGNORE INTO mini_project_role_mapping (id, target_role_pattern, mini_project_id, priority) VALUES
-- Frontend Developer Mappings
('mprm-fe-1', 'Frontend Developer', 'mp-fe-1', 1),
('mprm-fe-2', 'Frontend Developer', 'mp-fe-2', 2),
('mprm-fe-3', 'Frontend Developer', 'mp-fe-3', 3),

-- Backend Developer Mappings
('mprm-be-1', 'Backend Developer', 'mp-be-1', 1),
('mprm-be-2', 'Backend Developer', 'mp-be-2', 2),
('mprm-be-3', 'Backend Developer', 'mp-be-3', 3),

-- Data Scientist Mappings
('mprm-ds-1', 'Data Scientist', 'mp-ds-1', 1),
('mprm-ds-2', 'Data Scientist', 'mp-ds-2', 2),
('mprm-ds-3', 'Data Scientist', 'mp-ds-3', 3),

-- UI/UX Designer Mappings
('mprm-ui-1', 'UI/UX Designer', 'mp-ui-1', 1),
('mprm-ui-2', 'UI/UX Designer', 'mp-ui-2', 2),
('mprm-ui-3', 'UI/UX Designer', 'mp-ui-3', 3),

-- Freelance Mappings
('mprm-fl-1', 'Freelance', 'mp-fl-1', 1),
('mprm-fl-2', 'Freelance', 'mp-fl-2', 2),
('mprm-fl-3', 'Freelance', 'mp-fl-3', 3);


-- ── Figma-design mini projects (Frontend) ────────────────────────────────────
INSERT IGNORE INTO mini_projects (id, title, description, brief, level, duration, tag, related_skills, evaluation_criteria, sort_order, is_active) VALUES
('mp-react-testing-fund', 'React Testing Fundamentals', 'Build a complete checkout form using TDD approach with Jest & React Testing Library.', 'Build a complete checkout form using TDD — write failing tests first, then implement the component to make them pass. You will use Jest + React Testing Library throughout.\n\nWhat you will build:\nA multi-step checkout form with fields for shipping address, payment method, and order summary.\n\nDeliverables to submit:\n- Source code (GitHub repo link or .zip) containing your component files and all test files\n- Tests must cover: form validation (empty fields, invalid card number, invalid email), successful form submission, step navigation (next/back), and error state rendering\n- Minimum 15 passing test cases\n- A short README.md explaining your testing strategy and any edge cases you handled\n\nAcceptance criteria: All tests pass with npm test, code coverage >= 80%, no console errors.', 'Intermediate', '6 hrs', 'Testing', '["Jest","React Testing Library","TDD"]', '["15+ passing tests","Coverage >= 80%","README testing strategy"]', 11, 1),
('mp-css-responsive', 'CSS Responsive Mastery', 'Build a fully accessible UI component library following WCAG 2.1 AA.', 'Build a fully accessible UI component library following WCAG 2.1 AA standards. Components must be responsive across mobile, tablet, and desktop breakpoints.\n\nWhat you will build:\nA component library containing: navigation bar, hero banner, card grid, modal dialog, and form with validation states.\n\nDeliverables to submit:\n- A single index.html + styles.css file (no frameworks — vanilla CSS only)\n- Screenshot or screen recording showing all 3 breakpoints (375px, 768px, 1280px)\n- Accessibility audit report exported from Lighthouse or axe DevTools (score >= 90)\n- A written note (50-100 words) on how you handled keyboard navigation and color contrast\n\nAcceptance criteria: No horizontal scroll at any breakpoint, all interactive elements keyboard-accessible, passes Lighthouse accessibility audit.', 'Intermediate', '4 hrs', 'CSS', '["CSS","Responsive Design","Accessibility"]', '["3 breakpoints","Lighthouse a11y >= 90","Keyboard accessible"]', 12, 1),
('mp-react-component', 'React Component Basic', 'Build responsive landing page including a navbar, hero section, and call-to-action.', 'Build a responsive landing page that includes a navbar, hero section, and call-to-action. Focus on clean component architecture and proper props/state management.\n\nWhat you will build:\nA marketing landing page for a fictional SaaS product of your choice — be creative with the theme.\n\nDeliverables to submit:\n- GitHub repo link or .zip with all source files\n- The page must be broken into at least 6 separate components (Navbar, Hero, FeatureCard, CTAButton, Footer, etc.)\n- Props must be used to pass at least 3 dynamic values (e.g. headline text, feature list, CTA label)\n- One component must manage local state (e.g. mobile menu toggle, tab switcher)\n- Live demo link (Vercel, Netlify, or CodeSandbox) — required\n\nAcceptance criteria: No prop drilling beyond 2 levels, no inline styles, mobile-responsive, deploys without errors.', 'Intermediate', '4 hrs', 'React', '["React","Components","Props & State"]', '["6+ components","3+ dynamic props","Live demo link"]', 13, 1),
('mp-async-js', 'Async JavaScript Mastery', 'Master asynchronous JavaScript to handle tasks like API calls and timers.', 'Master asynchronous JavaScript by handling real-world tasks involving API calls, timers, parallel requests, and error recovery — without using any external libraries.\n\nWhat you will build:\nA dashboard that fetches and displays live data from a public API (your choice: weather, GitHub users, news, etc.), with loading states, error handling, and a refresh timer.\n\nDeliverables to submit:\n- Source files (.html + .js) — vanilla JS only, no frameworks or axios\n- Must demonstrate all three async patterns: callbacks (at least 1 use), Promises (at least 2 .then() chains), and async/await (at least 2 functions)\n- Implement Promise.all() to fetch at least 2 endpoints in parallel\n- Error handling: show a user-friendly error message when the API fails (you can simulate this)\n- A timer.js showing a countdown or polling mechanism using setInterval and clearInterval\n- Short write-up (50-100 words) comparing when you would use Promises vs async/await in a real project\n\nAcceptance criteria: No unhandled promise rejections, loading spinner visible during fetch, works on Chrome without any build step.', 'Intermediate', '6 hrs', 'JavaScript', '["Async/Await","Promises","Error Handling"]', '["3 async patterns","Promise.all parallel","No unhandled rejections"]', 14, 1);

INSERT IGNORE INTO mini_project_role_mapping (id, target_role_pattern, mini_project_id, priority) VALUES
('mprm-fe-rtf', 'Frontend Developer', 'mp-react-testing-fund', 4),
('mprm-fe-crm', 'Frontend Developer', 'mp-css-responsive', 5),
('mprm-fe-rcb', 'Frontend Developer', 'mp-react-component', 6),
('mprm-fe-ajm', 'Frontend Developer', 'mp-async-js', 7);
