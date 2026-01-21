import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a Python function code generator that outputs ONLY valid JSON.

=== OUTPUT FORMAT (MUST BE VALID JSON) ===
You MUST respond with a JSON object in this exact format:
{"code": "def function_name(param: type) -> return_type:\n    \"\"\"Docstring.\"\"\"\n    return result", "suggestedName": "function_name", "suggestedDescription": "Brief description"}

=== ABSOLUTE RULES ===
1. Output ONLY valid JSON - nothing else
2. The "code" field must contain ONLY the Python function definition
3. Function must start with "def "
4. NO decorators, NO imports, NO example usage
5. NO explanations, NO markdown, NO conversation
6. Escape newlines as \\n and quotes as \\"
7. suggestedName: snake_case matching function name
8. suggestedDescription: brief, clear (under 100 chars)

=== IF REQUEST IS INVALID ===
Output: {"code": "def invalid_request() -> str:\n    return \"Invalid request\"", "suggestedName": "invalid_request", "suggestedDescription": "Invalid request"}

You are a JSON code generator. Output valid JSON only.
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

        // Input validation: Limit prompt length to prevent abuse
        if (prompt.length > 10000) {
            return NextResponse.json(
                { error: 'Prompt is too long. Maximum 10,000 characters allowed.' },
                { status: 400 }
            );
        }

        // Sanitize previousResponseId if provided
        if (previousResponseId && (typeof previousResponseId !== 'string' || previousResponseId.length > 200)) {
            return NextResponse.json(
                { error: 'Invalid previousResponseId' },
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

        // Construct Azure URL for Responses API: https://{resource}.openai.azure.com/openai/v1/responses
        // Ensure endpoint doesn't have double trailing slash if user included it
        const baseUrl = azureEndpoint.replace(/\/+$/, '');
        const url = `${baseUrl}/openai/v1/responses`;

        // Build request body with optional previous_response_id for continuity
        const requestBody: Record<string, any> = {
            model: azureDeployment,
            input: previousResponseId 
                ? `${prompt} (respond in json format)`  // If continuing conversation, just send the follow-up prompt
                : `Generate a Python function that: ${prompt}. Respond in json format.`,
            max_output_tokens: 1024,
            text: {
                format: {
                    type: "json_object"
                }
            }
        };

        // Only include instructions on first request (not needed for follow-ups)
        if (!previousResponseId) {
            requestBody.instructions = SYSTEM_PROMPT;
        }

        // Add previous_response_id for conversation continuity
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
        
        // Extract the response ID for continuity
        const responseId = data.id;
        
        // Responses API returns output as an array of items
        // Extract text content from the output array
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

        // Try to parse as JSON first (structured output)
        let cleanCode = '';
        let suggestedName = '';
        let suggestedDescription = '';
        try {
            const jsonResponse = JSON.parse(rawOutput);
            if (jsonResponse.code) {
                cleanCode = jsonResponse.code;
            } else {
                // If JSON doesn't have 'code' field, use the raw output
                cleanCode = rawOutput;
            }
            // Extract suggested metadata
            suggestedName = jsonResponse.suggestedName || '';
            suggestedDescription = jsonResponse.suggestedDescription || '';
        } catch {
            // If JSON parsing fails, use raw output and clean it up
            cleanCode = rawOutput
                .replace(/^```python\n?/i, '')
                .replace(/^```\n?/i, '')
                .replace(/\n?```$/i, '')
                .trim();
        }

        // === HEAVY GUARDRAILS: Extract only valid Python function code ===
        // Find the first 'def ' and extract from there
        const defIndex = cleanCode.indexOf('def ');
        if (defIndex > 0) {
            // Remove any text before 'def '
            cleanCode = cleanCode.slice(defIndex);
        }

        // Remove trailing markdown fence if present
        cleanCode = cleanCode.replace(/\n?```\s*$/i, '');

        // Remove any trailing text after the function ends
        const lines = cleanCode.split('\n');
        let functionEndIndex = lines.length;
        let foundFunctionStart = false;
        let lastCodeLineIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Mark function start
            if (trimmedLine.startsWith('def ') && line.indexOf('def ') === 0) {
                foundFunctionStart = true;
                continue;
            }

            // If we're inside the function (indented lines or empty lines)
            if (foundFunctionStart) {
                // Check for patterns that indicate we've left the function
                const isUnindented = line.length > 0 && line[0] !== ' ' && line[0] !== '\t';
                
                if (isUnindented && trimmedLine.length > 0) {
                    // These patterns indicate code AFTER the function - cut here
                    if (trimmedLine.startsWith('# Example') ||
                        trimmedLine.startsWith('#Example') ||
                        trimmedLine.startsWith('# Usage') ||
                        trimmedLine.startsWith('if __name__') ||
                        trimmedLine.startsWith('"""') ||
                        trimmedLine.startsWith("'''") ||
                        /^[A-Z][a-z]/.test(trimmedLine) ||  // Sentence-like text
                        trimmedLine.startsWith('print(') ||
                        trimmedLine.match(/^\w+\s*=\s*\w+\(/) // Variable assignment like: result = func()
                    ) {
                        functionEndIndex = i;
                        break;
                    }
                }
                
                // Track last line that's part of the function (indented or return)
                if (line.startsWith('    ') || line.startsWith('\t') || trimmedLine === '') {
                    lastCodeLineIndex = i;
                }
            }
        }

        // Use the earlier of functionEndIndex or just after lastCodeLineIndex
        const cutIndex = Math.min(functionEndIndex, lastCodeLineIndex + 1);
        cleanCode = lines.slice(0, cutIndex === 0 ? lines.length : cutIndex).join('\n').trim();

        // Remove any trailing empty lines
        cleanCode = cleanCode.replace(/\n+$/g, '');

        // Final validation: must start with 'def '
        if (!cleanCode.startsWith('def ')) {
            return NextResponse.json(
                { error: 'Failed to generate valid function code. Please try again.' },
                { status: 400 }
            );
        }

        return NextResponse.json({ 
            code: cleanCode,
            responseId: responseId,  // Return for continuity in follow-up requests
            suggestedName: suggestedName || undefined,
            suggestedDescription: suggestedDescription || undefined
        });

    } catch (error) {
        console.error('Error generating function:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
