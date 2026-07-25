import { useEffect, useRef, useState } from "react";
import { compressImageFile } from "../imageUtils";
import { parseRecipeText } from "../recipeParser";

const SpeechRecognitionCtor =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function QuickCapture({ onParsed, onCancel }) {
  const [mode, setMode] = useState("photo"); // photo | voice
  const [text, setText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrError("");
    setOcrRunning(true);
    setOcrStatus("Reading photo…");
    try {
      const compressed = await compressImageFile(file);
      setPhoto(compressed);

      const Tesseract = await import("tesseract.js");
      const { data } = await Tesseract.recognize(compressed, "eng", {
        logger: (m) => {
          if (m.status && typeof m.progress === "number") {
            const pct = Math.round(m.progress * 100);
            setOcrStatus(`${statusLabel(m.status)} ${pct}%`);
          }
        },
      });
      const extracted = (data?.text || "").trim();
      setText((prev) => (prev ? `${prev}\n${extracted}` : extracted));
      setOcrStatus(extracted ? "Done reading photo." : "Couldn't find any text in that photo.");
    } catch {
      setOcrError("Couldn't read text from that photo — try a clearer shot, or type it in manually below.");
      setOcrStatus("");
    } finally {
      setOcrRunning(false);
    }
  }

  function statusLabel(status) {
    if (status.includes("recognizing")) return "Reading photo…";
    if (status.includes("loading") || status.includes("initializing")) return "Getting ready…";
    return "Working…";
  }

  function startRecording() {
    setVoiceError("");
    if (!SpeechRecognitionCtor) {
      setVoiceError("Voice dictation isn't supported in this browser.");
      return;
    }
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let finalChunk = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalChunk += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (finalChunk) {
          setText((prev) => (prev ? `${prev.replace(/\s+$/, "")}\n${finalChunk.trim()}` : finalChunk.trim()));
        }
        setInterimText(interim);
      };

      recognition.onerror = (event) => {
        setVoiceError(
          event.error === "not-allowed" || event.error === "permission-denied"
            ? "Microphone access was denied — allow microphone access to use voice dictation."
            : `Voice dictation stopped (${event.error}).`
        );
        setIsRecording(false);
        setInterimText("");
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText("");
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch {
      setVoiceError("Couldn't start voice dictation on this device.");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  function handleParse() {
    const draft = parseRecipeText(text);
    onParsed({ ...draft, photo });
  }

  return (
    <div className="quick-capture">
      <h1>Scan a recipe</h1>
      <p className="capture-intro">
        Photograph a handwritten card or dictate it while you read — then review and fix up the details before saving.
      </p>

      <div className="capture-tabs">
        <button className={`capture-tab ${mode === "photo" ? "active" : ""}`} onClick={() => setMode("photo")}>
          📷 Photo
        </button>
        <button
          className={`capture-tab ${mode === "voice" ? "active" : ""}`}
          onClick={() => setMode("voice")}
          disabled={!SpeechRecognitionCtor}
          title={SpeechRecognitionCtor ? undefined : "Voice dictation isn't supported in this browser"}
        >
          🎙️ Voice
        </button>
      </div>

      {mode === "photo" && (
        <div className="capture-panel">
          <label className="capture-file-label">
            Take or choose a photo of the recipe card
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} disabled={ocrRunning} />
          </label>
          {ocrStatus && <p className="capture-status">{ocrStatus}</p>}
          {ocrError && <p className="form-error">{ocrError}</p>}
          {photo && (
            <div className="photo-preview-row">
              <img className="photo-preview" src={photo} alt="Captured recipe card" />
              <button type="button" className="btn" onClick={() => setPhoto(null)}>
                Remove photo
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "voice" && (
        <div className="capture-panel">
          {SpeechRecognitionCtor ? (
            <>
              <button
                type="button"
                className={`btn mic-btn ${isRecording ? "recording" : ""}`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? "⏹ Stop recording" : "🎙️ Start dictating"}
              </button>
              {isRecording && <span className="recording-indicator">● Listening…</span>}
              {voiceError && <p className="form-error">{voiceError}</p>}
            </>
          ) : (
            <p className="capture-status">
              Voice dictation isn't supported in this browser. Try Chrome or Edge, or use the Photo tab instead.
            </p>
          )}
        </div>
      )}

      <label className="capture-textarea-label">
        Extracted / dictated text <span className="hint">(edit freely before parsing)</span>
        <textarea
          className="capture-textarea"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Ingredients:\n2 cups flour\n...\n\nInstructions:\nPreheat oven...\n"}
        />
      </label>
      {interimText && <p className="capture-interim">{interimText}</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleParse} disabled={!text.trim()}>
          Parse recipe →
        </button>
      </div>
    </div>
  );
}
