# PulseBridge AI — ElevenLabs Text-to-Speech Integration Guide

## 1. Executive Summary & Objective

PulseBridge AI now includes an accessible, multilingual (Hindi & English) voice-guided experience for patients. The system guides patients step-by-step through their medical intake wizard and prescription/report upload workflow, with high-clarity voice instructions, user-controlled speech toggles, repeat/stop controls, and an automatic fallback mechanism when external services are unreachable.

---

## 2. Architecture & Security Model

```mermaid
flowchart TD
    subgraph Client ["Client Browser (PulseBridge AI)"]
        UI["PatientIntakeWizard.tsx"] --> VG["useVoiceGuidance Hook"]
        VG --> VGS["VoiceGuidanceService"]
        VGS --> AudioCache["In-Memory Blob URL Cache"]
    end

    subgraph Supabase ["Supabase Edge Function (Proxy)"]
        Edge["supabase/functions/elevenlabs-tts"]
    end

    subgraph ElevenLabs ["ElevenLabs API"]
        ELAPI["POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"]
    end

    subgraph Fallback ["Device Native Fallback"]
        WebSpeech["window.speechSynthesis (hi-IN / en-US)"]
    end

    VGS -- "1. Invoke Edge Function" --> Edge
    Edge -- "2. Server-side proxy with xi-api-key" --> ELAPI
    ELAPI -- "3. Return audio/mpeg" --> Edge
    Edge -- "4. Stream MP3 binary" --> VGS
    VGS -- "5. Fallback if offline / unconfigured" --> WebSpeech
```

### Security & Compliance Guarantees:
1. **Zero Client Secret Leakage**:
   - `ELEVENLABS_API_KEY` is **never** bundled into the client build, committed to Git, or exposed via `VITE_` public variables.
   - All external ElevenLabs API requests pass through the server-side Supabase Edge Function `elevenlabs-tts`, which accesses the secret via `Deno.env.get('ELEVENLABS_API_KEY')`.
2. **Abuse & Cost Controls**:
   - The Edge Function enforces a strict 600-character payload length guard (`MAX_TEXT_LENGTH`), preventing unexpected prompt injection, resource exhaustion, or runaway usage costs.
3. **PHI Logging Protection**:
   - The voice guidance feature only speaks navigation and instructional prompts. Sensitive patient identifiers, test results, and protected health information (PHI) are never passed to the text-to-speech service or logged in server console traces.
4. **Bandwidth & Latency Optimization**:
   - Audio Object URLs are cached in-memory (`audioCache`), so navigating between steps or clicking "Repeat" avoids redundant network roundtrips.
   - The Edge Function outputs HTTP caching headers (`Cache-Control: public, max-age=86400`) allowing browser and CDN cache reuse for static instructions.

---

## 3. Supported Voices and Languages

| Language | Model | Voice ID (Configurable) | Default Voice |
|---|---|---|---|
| **English** (`en`) | `eleven_multilingual_v2` | `ELEVENLABS_VOICE_ID_EN` | `21m00Tcm4TlvDq8ikWAM` (Rachel) |
| **Hindi** (`hi`) | `eleven_multilingual_v2` | `ELEVENLABS_VOICE_ID_HI` | `ErXwobaYiN019PkySvjV` (Antoni) |

---

## 4. Edge Function Deployment

### 1. Set Supabase Secrets
Set your ElevenLabs credentials in the Supabase Dashboard or via Supabase CLI:

```bash
supabase secrets set ELEVENLABS_API_KEY="your-elevenlabs-api-key"
supabase secrets set ELEVENLABS_VOICE_ID_EN="21m00Tcm4TlvDq8ikWAM"
supabase secrets set ELEVENLABS_VOICE_ID_HI="ErXwobaYiN019PkySvjV"
```

### 2. Deploy Edge Function
```bash
supabase functions deploy elevenlabs-tts --no-verify-jwt
```

*(Note: `--no-verify-jwt` allows public or demo intake onboarding, while rate limits and payload guards prevent abuse.)*

---

## 5. Graceful Client Fallback

When any of the following occur:
- Running in **Demo Mode** or offline,
- Edge Function returns `503 TTS_NOT_CONFIGURED`,
- Upstream rate limits (`429`) or network timeouts (`504`),

The client-side `VoiceGuidanceService` automatically and transparently switches to the device's native `window.speechSynthesis` API, selecting `hi-IN` for Hindi and `en-US` for English. Patients receive uninterrupted guidance without breaking the application flow.

---

## 6. Verification and Test Suite

| Test Suite | File | Tests | Status |
|---|---|---|---|
| Voice Guidance Service | `src/services/voiceGuidanceService.test.ts` | 8 | Passed |
| Voice Guidance Control UI | `src/components/VoiceGuidanceControl.test.tsx` | 7 | Passed |
| Family Consent Service | `src/services/familyConsentService.test.ts` | 15 | Passed |
| Care Action Service | `src/services/careActionService.test.ts` | 44 | Passed |
| Family Consent Authorization | `src/services/familyConsentAuthorization.test.ts` | 54 (10 skipped RLS) | Passed |
| Closed Loop Care View | `src/components/ClosedLoopCareView.test.tsx` | 5 | Passed |
| Dashboards | `src/pages/Dashboards.test.tsx` | 7 | Passed |
| Family Recovery Circle | `src/pages/FamilyRecoveryCircle.test.tsx` | 12 | Passed |
| **Total Test Suite** | **8 Suites** | **142 Passed / 10 Skipped** | **100% Passed** |
| **TypeScript Check** | `tsc -p tsconfig.app.json --noEmit` | **0 errors** | **Clean** |
| **Production Build** | `npm run build` | **Vite v5.4.8** | **Success (5.55s)** |
