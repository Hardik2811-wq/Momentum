/**
 * Tier 2: On-Device Small Language Model & Gemini Nano Prompt API
 * 
 * Provides zero-cloud, 100% private, zero-latency local intelligence
 * via the Chrome Built-in Prompt API (window.ai.languageModel) on compatible
 * devices (desktop Chrome 128+ or Android with Gemini Nano).
 */

export async function isLocalAiAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.ai?.languageModel) {
      const caps = await window.ai.languageModel.capabilities();
      return caps.available === 'readily' || caps.available === 'after-download';
    }
  } catch {
    return false;
  }
  return false;
}

export async function promptOnDeviceAi(taskTitle, candidateTasks = []) {
  if (typeof window === 'undefined') return null;
  if (!window.ai?.languageModel) return null;

  try {
    const caps = await window.ai.languageModel.capabilities();
    if (caps.available !== 'readily') return null;

    const session = await window.ai.languageModel.create({
      systemPrompt: 'You are an on-device causal intelligence assistant. Analyze if any candidate task is a natural causal prerequisite to the target task. Respond in JSON with suggestedPrerequisites array.'
    });

    const candidatesList = candidateTasks.slice(0, 10).map(t => `[id: ${t.id}] ${t.title}`).join('\n');
    const prompt = `Target Task: "${taskTitle}"\nCandidate Tasks:\n${candidatesList}\n\nIdentify if any candidate task must naturally be completed first (e.g. Taking a bath before going out for breakfast, groceries before cooking). Output JSON: {"suggestedPrerequisites": [{"taskId": "...", "title": "...", "badge": "...", "reason": "..."}]}`;

    const rawResponse = await session.prompt(prompt);
    session.destroy();

    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (err) {
    console.warn('On-device AI (Tier 2) skipped:', err);
    return null;
  }
}
