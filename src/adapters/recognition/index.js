// Adapter: Recognition — future AI recognition placeholder
// Currently no-op. Will support:
// - parse food text (natural language → food items)
// - image recognition (photo → food items)
// - voice recognition (speech → food items)
export async function parseFoodText(text) {
  // TODO: integrate with AI service
  return { items: [], raw: text }
}

export async function recognizeFoodImage(imageData) {
  // TODO: integrate with vision service
  return { items: [], raw: imageData }
}

export async function recognizeFoodVoice(audioData) {
  // TODO: integrate with speech service
  return { items: [], raw: audioData }
}
