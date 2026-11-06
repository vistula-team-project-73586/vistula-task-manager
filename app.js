
let config;
let editingTaskId = null;

const taskForm = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const taskList = document.getElementById("task-list");
const statusMessage = document.getElementById("status-message");
const submitButton = document.getElementById("task-submit");
const cancelButton = document.getElementById("cancel-edit");
const formHeading = document.getElementById("form-heading");

// Load configuration and initialize the application
async function initializeApp() {
    try {
        const response = await fetch("./config.json");

        if (!response.ok) {
            throw new Error("Could not load config.json");
        }

        config = await response.json();

        if (!config.supabaseUrl || !config.supabasePublishableKey) {
            throw new Error("Supabase configuration is incomplete.");
        }

        config.supabaseUrl = config.supabaseUrl.replace(/\/$/, "");

        await loadTasks();

    } catch (error) {
        showMessage(error.message, true);
        taskList.textContent = "Unable to load tasks.";
    }
}

// Build the Supabase REST API endpoint
function getTasksEndpoint() {
    return `${config.supabaseUrl}/rest/v1/${config.tableName}`;
}

// Common request headers
function getHeaders() {
    return {
        "apikey": config.supabasePublishableKey,
        "Authorization": `Bearer ${config.supabasePublishableKey}`,
        "Content-Type": "application/json"
    };
}

// Display status messages
function showMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? "error" : "success";
}

// Send requests to Supabase
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...getHeaders(),
            ...options.headers
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed: ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// GET: Load all tasks
async function loadTasks() {
    try {
        taskList.textContent = "Loading tasks...";

        const tasks = await apiRequest(
            `${getTasksEndpoint()}?select=*&order=id.desc`
        );

        displayTasks(tasks);

    } catch (error) {
        taskList.textContent = "Could not retrieve tasks.";
        showMessage("Error loading tasks: " + error.message, true);
    }
}

// Display tasks on the page
function displayTasks(tasks) {
    taskList.replaceChildren();

    if (!tasks || tasks.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No tasks yet. Add your first task!";
        taskList.appendChild(emptyMessage);
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement("article");

        item.className = task.completed
            ? "task-item completed"
            : "task-item";

        item.dataset.id = task.id;

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;

        const description = document.createElement("p");
        description.className = "task-description";
        description.textContent = task.description || "No description";

        const status = document.createElement("p");
        status.className = "task-status";
        status.textContent = task.completed
            ? "Completed"
            : "Incomplete";

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "edit-task";
        editButton.textContent = "Edit";

        editButton.addEventListener("click", () => {
            editTask(task);
        });

        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "toggle-task";
        toggleButton.textContent = task.completed
            ? "Mark Incomplete"
            : "Mark Complete";

        toggleButton.addEventListener("click", () => {
            toggleTask(task);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-task";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {
            deleteTask(task.id);
        });

        actions.append(editButton, toggleButton, deleteButton);

        item.append(title, description, status, actions);
        taskList.appendChild(item);
    });
}

// POST: Add a new task
async function addTask(title, description) {
    await apiRequest(getTasksEndpoint(), {
        method: "POST",
        headers: {
            "Prefer": "return=representation"
        },
        body: JSON.stringify({
            title,
            description,
            completed: false
        })
    });

    showMessage("Task added successfully!");
    await loadTasks();
}

// Load an existing task into the form
function editTask(task) {
    editingTaskId = task.id;

    titleInput.value = task.title;
    descriptionInput.value = task.description || "";

    submitButton.textContent = "Save Changes";
    formHeading.textContent = "Edit Task";
    cancelButton.hidden = false;

    titleInput.focus();
}

// PATCH: Update task title and description
async function updateTask(id, title, description) {
    await apiRequest(
        `${getTasksEndpoint()}?id=eq.${encodeURIComponent(id)}`,
        {
            method: "PATCH",
            headers: {
                "Prefer": "return=representation"
            },
            body: JSON.stringify({
                title,
                description
            })
        }
    );

    showMessage("Task updated successfully!");
    resetForm();
    await loadTasks();
}

// PATCH: Toggle completion status
async function toggleTask(task) {
    try {
        await apiRequest(
            `${getTasksEndpoint()}?id=eq.${encodeURIComponent(task.id)}`,
            {
                method: "PATCH",
                headers: {
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    completed: !task.completed
                })
            }
        );

        showMessage("Task status updated!");
        await loadTasks();

    } catch (error) {
        showMessage("Error updating status: " + error.message, true);
    }
}

// DELETE: Remove a task
async function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) {
        return;
    }

    try {
        await apiRequest(
            `${getTasksEndpoint()}?id=eq.${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        showMessage("Task deleted successfully!");
        await loadTasks();

    } catch (error) {
        showMessage("Error deleting task: " + error.message, true);
    }
}

// Reset the form after editing or cancelling
function resetForm() {
    editingTaskId = null;
    taskForm.reset();

    submitButton.textContent = "Add Task";
    formHeading.textContent = "Add a New Task";
    cancelButton.hidden = true;
}

// Handle form submission
taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
        showMessage("Task title is required.", true);
        return;
    }

    submitButton.disabled = true;

    try {
        if (editingTaskId !== null) {
            await updateTask(editingTaskId, title, description);
        } else {
            await addTask(title, description);
            taskForm.reset();
        }

    } catch (error) {
        showMessage("Operation failed: " + error.message, true);

    } finally {
        submitButton.disabled = false;
    }
});

// Cancel editing
cancelButton.addEventListener("click", resetForm);

// Start the application
initializeApp();
