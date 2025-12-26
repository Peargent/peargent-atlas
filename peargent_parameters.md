# Peargent API Parameters Reference

Complete reference for all configurable parameters in Peargent components.

---

## `create_agent()`

| Parameter | Type | Required | Options / Default | Description |
|-----------|------|----------|-------------------|-------------|
| `name` | `str` | ✅ | — | Agent name |
| `description` | `str` | ✅ | — | Agent description |
| `persona` | `str` | ✅ | — | Agent persona/system prompt |
| `model` | Model | ❌ | `None` | LLM model instance (see Models below) |
| `tools` | `list` | ❌ | `[]` | List of Tool instances or tool names |
| `stop` | StopCondition | ❌ | `None` | Stop condition |
| `history` | HistoryConfig / ConversationHistory | ❌ | `None` | Conversation history config |
| `tracing` | `bool` | ❌ | `None` (inherit) | `True` / `False` / `None` (inherit from global) |
| `output_schema` | Pydantic Model | ❌ | `None` | Pydantic model for structured output |
| `max_retries` | `int` | ❌ | `3` | Any positive integer (retries for structured output) |

---

## `create_tool()`

| Parameter | Type | Required | Options / Default | Description |
|-----------|------|----------|-------------------|-------------|
| `name` | `str` | ❌* | Auto-inferred from function | Tool name |
| `description` | `str` | ❌* | Auto-inferred from docstring | Tool description |
| `input_parameters` | `dict` | ❌* | Auto-inferred from signature | `{"param": type, ...}` |
| `call_function` | `callable` | ❌ | — | Function to execute (required in function mode) |
| `timeout` | `float` | ❌ | `None` (no limit) | Max execution time in seconds |
| `max_retries` | `int` | ❌ | `0` | Any positive integer (retry attempts) |
| `retry_delay` | `float` | ❌ | `1.0` | Initial delay between retries (seconds) |
| `retry_backoff` | `bool` | ❌ | `True` | `True` (exponential) / `False` (fixed delay) |
| `on_error` | `str` | ❌ | `"raise"` | `"raise"` / `"return_error"` / `"return_none"` |
| `output_schema` | Pydantic Model | ❌ | `None` | Pydantic model for output validation |

> *Required in function mode, optional in decorator mode (auto-inferred)

---

## `create_pool()`

| Parameter | Type | Required | Options / Default | Description |
|-----------|------|----------|-------------------|-------------|
| `agents` | `list[Agent]` | ✅ | — | List of Agent instances |
| `default_model` | Model | ❌ | `None` | Default LLM for agents without one |
| `router` | RouterFn / RoutingAgent | ❌ | Round-robin | Router function or RoutingAgent |
| `max_iter` | `int` | ❌ | `5` | Any positive integer (max agent executions) |
| `default_state` | `State` | ❌ | `None` | Optional State instance |
| `history` | HistoryConfig / ConversationHistory | ❌ | `None` | Conversation history config |
| `tracing` | `bool` | ❌ | `False` | `True` / `False` |

---

## `create_routing_agent()`

| Parameter | Type | Required | Options / Default | Description |
|-----------|------|----------|-------------------|-------------|
| `name` | `str` | ✅ | — | Router agent name |
| `model` | Model | ✅ | — | LLM model instance |
| `persona` | `str` | ✅ | — | Router persona/system prompt |
| `agents` | `list[Agent]` | ✅ | — | List of available agents to route to |

---

## `create_history()`

| Parameter | Type | Required | Options / Default | Description |
|-----------|------|----------|-------------------|-------------|
| `store_type` | StorageType / `str` | ❌ | `"session_buffer"` | Storage backend (see options below) |

### String-based API (legacy)

| `store_type` Value | Additional Parameters |
|--------------------|----------------------|
| `"session_buffer"` | None |
| `"file"` | `storage_dir: str = ".peargent_history"` |
| `"sqlite"` | `database_path: str = "peargent_history.db"`, `table_prefix: str = "peargent"` |
| `"postgresql"` | `connection_string: str` (required), `table_prefix: str = "peargent"` |

---

## `HistoryConfig`

| Parameter | Type | Required | Options / Default | Description |
|-----------|------|----------|-------------------|-------------|
| `auto_manage_context` | `bool` | ❌ | `False` | Enable automatic context window management |
| `max_context_messages` | `int` | ❌ | `20` | Any positive integer |
| `strategy` | `str` | ❌ | `"smart"` | `"smart"` / `"trim_last"` / `"trim_first"` / `"summarize"` / `"first_last"` |
| `summarize_model` | Model | ❌ | `None` | Model for summarization (auto-inferred if not set) |
| `store` | StorageType / ConversationHistory | ❌ | `InMemory()` | Storage backend |

---

## Storage Types (for `store` parameter)

### `InMemory()`
No parameters.

```python
InMemory()
```

---

### `File()`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `storage_dir` | `str` | ❌ | `".peargent_history"` | Directory to store history files |

```python
File(storage_dir="./my_conversations")
```

---

### `Sqlite()`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `database_path` | `str` | ❌ | `"peargent_history.db"` | Path to SQLite database file |
| `table_prefix` | `str` | ❌ | `"peargent"` | Prefix for table names |

```python
Sqlite(database_path="./chat.db", table_prefix="myapp")
```

> **Note:** Requires `pip install sqlalchemy`

---

### `Postgresql()`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `connection_string` | `str` | ✅ | — | PostgreSQL connection string |
| `table_prefix` | `str` | ❌ | `"peargent"` | Prefix for table names |

```python
Postgresql(
    connection_string="postgresql://user:pass@localhost:5432/mydb",
    table_prefix="myapp"
)
```

> **Note:** Requires `pip install sqlalchemy`

---

### `Redis()`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `host` | `str` | ❌ | `"localhost"` | Redis server host |
| `port` | `int` | ❌ | `6379` | Redis server port |
| `db` | `int` | ❌ | `0` | Redis database number |
| `password` | `str` | ❌ | `None` | Redis password |
| `key_prefix` | `str` | ❌ | `"peargent"` | Prefix for Redis keys |

```python
Redis(host="localhost", port=6379, db=0, password="secret", key_prefix="myapp")
```

> **Note:** Requires `pip install redis`

---

## Models

Available model providers:

| Provider | Import | Example |
|----------|--------|---------|
| Groq | `from peargent.models import groq` | `groq("llama-3.3-70b-versatile")` |
| Gemini | `from peargent.models import gemini` | `gemini("gemini-2.0-flash")` |
| OpenAI | `from peargent.models import openai` | `openai("gpt-4o")` |
| Anthropic | `from peargent.models import anthropic` | `anthropic("claude-3-5-sonnet-20241022")` |

---

## Quick Examples

```python
from peargent import create_agent, create_pool, create_tool, create_routing_agent, create_history, HistoryConfig
from peargent import InMemory, File, Sqlite, Postgresql, Redis
from peargent.models import gemini

# Tool with all options
@create_tool(
    name="fetch_data",
    description="Fetch data from API",
    timeout=5.0,
    max_retries=3,
    retry_backoff=True,
    on_error="return_error"
)
def fetch_data(url: str) -> dict:
    pass

# Agent with history
agent = create_agent(
    name="Assistant",
    description="Helpful assistant",
    persona="You are helpful.",
    model=gemini("gemini-2.0-flash"),
    tools=[fetch_data],
    history=HistoryConfig(
        auto_manage_context=True,
        max_context_messages=15,
        strategy="smart",
        store=Sqlite(database_path="./history.db")
    ),
    tracing=True,
    max_retries=3
)

# Pool with history
pool = create_pool(
    agents=[agent],
    router=create_routing_agent(
        name="Router",
        model=gemini("gemini-2.0-flash"),
        persona="Route to the best agent.",
        agents=[agent]
    ),
    max_iter=10,
    history=create_history(store_type=File(storage_dir="./pool_history")),
    tracing=True
)
```
