/**
 * Generates Python code from .pear JSON data
 * Produces a class-based structure that can be run independently
 */

interface ToolData {
    name: string;
    description: string;
    source_code: string;
    input_parameters: Record<string, string>;
    max_retries?: number;
    retry_delay?: number;
    retry_backoff?: boolean;
    on_error?: string;
}

interface AgentData {
    name: string;
    description: string;
    persona?: string;
    model?: {
        type: string;
        model_name: string;
    };
    tools?: ToolData[];
    max_retries?: number;
    tracing?: boolean;
    auto_manage_context?: boolean;
    max_context_messages?: number;
    context_strategy?: string;
}

interface RouterData {
    name: string;
    persona?: string;
    description?: string;
    model?: {
        type: string;
        model_name: string;
    };
    agents?: string[];
}

interface PoolData {
    type: string;
    agents?: AgentData[];
    router?: RouterData;
    max_iter?: number;
    history?: {
        type: string;
        store_type: string;
    };
    tracing?: boolean;
}

interface PearData {
    type: string;
    data: PoolData | AgentData;
}

/**
 * Escape a string for Python triple-quoted strings
 */
function escapePythonString(str: string): string {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"""/g, '\\"\\"\\"')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
}

/**
 * Convert model type to Python import/instantiation
 */
function getModelCode(model: { type: string; model_name: string } | undefined): string {
    if (!model) return 'None';
    
    const modelType = model.type.toLowerCase();
    const modelName = model.model_name;
    
    if (modelType.includes('groq')) {
        return `groq("${modelName}")`;
    } else if (modelType.includes('openai')) {
        return `openai("${modelName}")`;
    } else if (modelType.includes('anthropic')) {
        return `anthropic("${modelName}")`;
    }
    
    // Default fallback
    return `groq("${modelName}")`;
}

/**
 * Extract unique tools from all agents
 */
function extractUniqueTools(agents: AgentData[]): Map<string, ToolData> {
    const toolMap = new Map<string, ToolData>();
    
    agents.forEach(agent => {
        agent.tools?.forEach(tool => {
            if (!toolMap.has(tool.name)) {
                toolMap.set(tool.name, tool);
            }
        });
    });
    
    return toolMap;
}

/**
 * Generate the imports section
 */
function generateImports(hasRouter: boolean, hasHistory: boolean): string {
    const imports = ['create_agent', 'create_pool', 'create_tool'];
    
    if (hasRouter) {
        imports.push('create_routing_agent');
    }
    if (hasHistory) {
        imports.push('create_history');
    }
    
    return `from peargent import ${imports.join(', ')}
from peargent.models import groq`;
}

/**
 * Extract function body from source_code (removes decorator if present)
 */
function extractFunctionBody(sourceCode: string): string {
    if (!sourceCode) return '';
    // Find the 'def ' line and return from there
    const defMatch = sourceCode.match(/^(def\s+.+)/m);
    if (defMatch) {
        const defIndex = sourceCode.indexOf(defMatch[0]);
        return sourceCode.slice(defIndex);
    }
    return sourceCode;
}

/**
 * Generate tool function code with auto-generated decorator
 */
function generateToolCode(tool: ToolData & { function_body?: string }): string {
    // Use function_body if available (edited by user), otherwise extract from source_code
    let functionBody = tool.function_body || extractFunctionBody(tool.source_code);
    
    // If no function body available, generate a placeholder
    if (!functionBody) {
        const params = Object.entries(tool.input_parameters || {})
            .map(([name, type]) => `${name}: ${type}`)
            .join(', ');
        functionBody = `def ${tool.name}(${params}) -> str:
    return "Not implemented"`;
    }
    
    // Escape description for Python string
    const escapedDesc = tool.description?.replace(/"/g, '\\"') || '';
    
    // Generate the decorator + function
    const decorator = `@create_tool(name="${tool.name}", description="${escapedDesc}")`;
    
    return `${decorator}\n${functionBody}\n`;
}

/**
 * Generate agent creation code
 */
function generateAgentCode(agent: AgentData, index: number): string {
    const varName = `agent_${agent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const toolNames = agent.tools?.map(t => t.name).join(', ') || '';
    const modelCode = getModelCode(agent.model);
    
    let code = `        # Agent ${index + 1}: ${agent.name}\n`;
    
    if (agent.persona) {
        code += `        persona_${index} = """${escapePythonString(agent.persona)}"""\n\n`;
    }
    
    code += `        ${varName} = create_agent(\n`;
    code += `            name="${agent.name}",\n`;
    code += `            description="${escapePythonString(agent.description || '')}",\n`;
    
    if (agent.persona) {
        code += `            persona=persona_${index},\n`;
    }
    
    if (toolNames) {
        code += `            tools=[${toolNames}],\n`;
    }
    
    code += `            model=${modelCode},\n`;
    
    if (agent.max_retries !== undefined) {
        code += `            max_retries=${agent.max_retries},\n`;
    }
    
    if (agent.tracing) {
        code += `            tracing=${agent.tracing ? 'True' : 'False'},\n`;
    }
    
    code += `        )\n`;
    
    return code;
}

/**
 * Generate router creation code
 */
function generateRouterCode(router: RouterData): string {
    const modelCode = getModelCode(router.model);
    
    let code = `        # Router\n`;
    
    if (router.persona) {
        code += `        router_persona = """${escapePythonString(router.persona)}"""\n\n`;
    }
    
    code += `        self.router = create_routing_agent(\n`;
    code += `            name="${router.name}",\n`;
    code += `            model=${modelCode},\n`;
    
    if (router.persona) {
        code += `            persona=router_persona,\n`;
    }
    
    code += `            agents=self.agents\n`;
    code += `        )\n`;
    
    return code;
}

/**
 * Generate pool creation code
 */
function generatePoolCode(poolData: PoolData): string {
    let code = `        # Create Pool\n`;
    code += `        self.pool = create_pool(\n`;
    code += `            agents=self.agents,\n`;
    
    if (poolData.router) {
        code += `            router=self.router,\n`;
    }
    
    if (poolData.max_iter !== undefined) {
        code += `            max_iter=${poolData.max_iter},\n`;
    }
    
    if (poolData.history) {
        code += `            history=self.history,\n`;
    }
    
    if (poolData.tracing) {
        code += `            tracing=${poolData.tracing ? 'True' : 'False'},\n`;
    }
    
    code += `        )\n`;
    
    return code;
}

/**
 * Main function to generate Python code from .pear data
 */
export function generatePythonCode(pearData: PearData, className: string = 'GeneratedAgentSystem'): string {
    if (pearData.type !== 'pool' && pearData.type !== 'agent') {
        throw new Error(`Unsupported pear type: ${pearData.type}`);
    }
    
    const poolData = pearData.data as PoolData;
    const agents = poolData.agents || [];
    const hasRouter = !!poolData.router;
    const hasHistory = !!poolData.history;
    
    // Extract unique tools
    const uniqueTools = extractUniqueTools(agents);
    
    // Build the Python code
    let code = `"""
Auto-generated from .pear file
This file reconstructs the agent system configuration
"""

${generateImports(hasRouter, hasHistory)}


`;

    // Generate tool functions at module level
    code += `# ═══════════════════════════════════════════════════════════════════════════════\n`;
    code += `# TOOLS\n`;
    code += `# ═══════════════════════════════════════════════════════════════════════════════\n\n`;
    
    uniqueTools.forEach((tool) => {
        code += generateToolCode(tool);
        code += '\n';
    });
    
    // Generate the class
    code += `\n# ═══════════════════════════════════════════════════════════════════════════════\n`;
    code += `# AGENT SYSTEM CLASS\n`;
    code += `# ═══════════════════════════════════════════════════════════════════════════════\n\n`;
    
    code += `class ${className}:\n`;
    code += `    """Auto-generated agent system from .pear configuration"""\n\n`;
    
    code += `    def __init__(self):\n`;
    
    // History initialization
    if (hasHistory && poolData.history) {
        const storeType = poolData.history.store_type?.toLowerCase().replace('historystore', '') || 'sqlite';
        code += `        # Initialize History\n`;
        code += `        self.history = create_history("${storeType}", database_path="./history.db")\n`;
        code += `        self.history.create_thread()  # Create a thread for the conversation\n\n`;
    }
    
    // Generate agents
    code += `        # Initialize Agents\n`;
    const agentVarNames: string[] = [];
    agents.forEach((agent, index) => {
        code += generateAgentCode(agent, index);
        code += '\n';
        agentVarNames.push(`agent_${agent.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
    });
    
    // Agent list
    code += `        self.agents = [${agentVarNames.join(', ')}]\n\n`;
    
    // Router
    if (hasRouter && poolData.router) {
        code += generateRouterCode(poolData.router);
        code += '\n';
    }
    
    // Pool
    code += generatePoolCode(poolData);
    
    // Run method
    code += `\n    def run(self, query: str):\n`;
    code += `        """Run a query through the agent system"""\n`;
    code += `        return self.pool.run(query)\n`;
    
    // Main block
    code += `\n\n# ═══════════════════════════════════════════════════════════════════════════════\n`;
    code += `# MAIN\n`;
    code += `# ═══════════════════════════════════════════════════════════════════════════════\n\n`;
    code += `if __name__ == "__main__":\n`;
    code += `    system = ${className}()\n`;
    code += `    # Example: result = system.run("Your query here")\n`;
    code += `    print(f"${className} initialized with {len(system.agents)} agents")\n`;
    
    return code;
}

/**
 * Generate a suggested filename from the .pear filename
 */
export function suggestPythonFilename(pearFilename: string): string {
    const baseName = pearFilename.replace(/\.pear$/i, '');
    return `${baseName}.py`;
}
