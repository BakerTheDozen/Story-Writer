window.StoryWriterAI = {
    generateProse: async (state) => {
        const { apiKey, currentChapter, characters, chapters, projectName } = state;

        const historyContext = chapters.length > 0
            ? `PREVIOUS CHAPTER SUMMARIES (for continuity):\n${chapters.map((ch, i) => `Ch ${i + 1}: ${ch.summary}`).join('\n')}`
            : "This is the start of the story.";

        const characterContext = characters.length > 0
            ? `CHARACTERS INVOLVED:\n${characters.map(c => `- ${c.name}: ${c.role}`).join('\n')}`
            : "No specific character details provided.";

        const prompt = `
            You are a master novelist working on a project titled "${projectName || 'Untitled Story'}".
            Write a compelling, immersive story chapter.
            
            ${historyContext}
            
            CURRENT CHAPTER GOAL:
            ${currentChapter.goal}
            
            SETTING:
            ${currentChapter.setting}
            
            TONE/MOOD:
            ${currentChapter.tone}
            
            ${characterContext}
            
            STYLE CONSTRAINTS (CRITICAL):
            - AVOID FLOWERY PROSE: Do not use excessive metaphors or abstract "poetic" language. 
            - NATURAL DIALOGUE: Characters should speak like real people. Avoid "speechifying" or overly formal sentence structures.
            - PUNCTUATION: Do not use double-dashes (--) for pauses or interruptions. Use proper em-dashes (—) or commas.
            - GROUNDED DESCRIPTION: Focus on physical sensations (weight, temperature, grit) rather than emotional abstractions.
            
            Please write the full prose for this chapter. Focus on "show, don't tell" through action and concrete details.
            If previous chapters were provided, ensure consistency in character voice and plot progression.
        `.trim();

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                // Adding a temperature slight reduction can also help with "flowery" wandering
                generationConfig: {
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to generate content');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
};