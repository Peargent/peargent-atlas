import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an AI agent persona generator that outputs ONLY valid JSON.

=== OUTPUT FORMAT (MUST BE VALID JSON) ===
You MUST respond with a JSON object in this exact format:
{"persona": "The detailed persona/system prompt text", "suggestedName": "agent_name", "suggestedDescription": "Brief description"}

=== NAMING RULES (CRITICAL) ===
- suggestedName MUST be a clear, descriptive snake_case name
- The name should clearly indicate what the agent DOES
- Use format: role_domain or action_domain
- GOOD: "quantum_physics_researcher", "customer_support_agent", "code_review_assistant"
- BAD: "qubit_sage", "quantum_wizard", "physics_master" (too vague/creative)

=== DESCRIPTION RULES ===
- suggestedDescription: exactly 1 clear sentence, under 80 characters
- Describe WHAT the agent does functionally, not personality
- GOOD: "Answers quantum physics questions and explains concepts"
- BAD: "A wise and knowledgeable quantum physics expert" (too vague)

=== PERSONA RULES ===
1. Output ONLY valid JSON - nothing else
2. The "persona" field must contain a well-crafted system prompt
3. Define role, capabilities, personality, and behavior
4. NO markdown, NO conversation, NO explanations outside JSON
5. Escape newlines as \\\\n and quotes as \\\\"

=== IF REQUEST IS INVALID ===
Output: {"persona": "You are a helpful AI assistant.", "suggestedName": "general_assistant", "suggestedDescription": "Provides helpful responses to general queries"}

You are a JSON persona generator. Output valid JSON only.
`;

export async function POST(request: NextRequest) {
    try {
        const { prompt, previousResponseId } = await request.json();

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400 }
            );
        }

        // Azure OpenAI Configuration
        const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
        const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;

        if (!azureEndpoint || !azureApiKey || !azureDeployment) {
            return NextResponse.json(
                { error: 'Azure OpenAI credentials are not configured. Please check environment variables.' },
                { status: 500 }
            );
        }

        const baseUrl = azureEndpoint.replace(/\/+$/, '');
        const url = `${baseUrl}/openai/v1/responses`;

        // Build request body
        const requestBody: Record<string, any> = {
            model: azureDeployment,
            input: previousResponseId 
                ? `${prompt} (respond in json format)`
                : `Generate an AI agent persona that: ${prompt}. Respond in json format.`,
            max_output_tokens: 1024,
            text: {
                format: {
                    type: "json_object"
                }
            }
        };

        if (!previousResponseId) {
            requestBody.instructions = SYSTEM_PROMPT;
        }

        if (previousResponseId) {
            requestBody.previous_response_id = previousResponseId;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': azureApiKey,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Azure API Error:', errorData);
            return NextResponse.json(
                { error: errorData.error?.message || `Azure API Error: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        const responseId = data.id;

        // Extract text content from output
        let rawOutput = '';
        if (data.output && Array.isArray(data.output)) {
            for (const item of data.output) {
                if (item.type === 'message' && item.content) {
                    for (const content of item.content) {
                        if (content.type === 'output_text' || content.type === 'text') {
                            rawOutput += content.text || '';
                        }
                    }
                }
            }
        }
        rawOutput = rawOutput.trim();

        // Parse JSON response
        let persona = '';
        let suggestedName = '';
        let suggestedDescription = '';
        try {
            const jsonResponse = JSON.parse(rawOutput);
            persona = jsonResponse.persona || '';
            suggestedName = jsonResponse.suggestedName || '';
            suggestedDescription = jsonResponse.suggestedDescription || '';
        } catch {
            // If JSON parsing fails, use raw output as persona
            persona = rawOutput;
        }

        if (!persona) {
            return NextResponse.json(
                { error: 'Failed to generate persona. Please try again.' },
                { status: 400 }
            );
        }

        return NextResponse.json({ 
            persona,
            responseId,
            suggestedName: suggestedName || undefined,
            suggestedDescription: suggestedDescription || undefined
        });

    } catch (error) {
        console.error('Error generating persona:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
