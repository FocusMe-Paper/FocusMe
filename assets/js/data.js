/* =========================================================================
   DEMO DATA  —  this is the only file you normally need to edit.
   -------------------------------------------------------------------------
   columns    : the signals / systems shown for every sample (left -> right)
                suffix -> file name is  <audioDir><sample.id>-<suffix>.wav
                group  -> "ref" | "input" | "baseline" | "ours"
                          ("baseline" and "ours" are anonymised in blind mode)
                blurb  -> tooltip on the column header
   conditions : one tab per test condition
                samples[].id   -> must match the wav file prefix
                samples[].text -> displayed utterance (replace with real transcripts)

   Audio provenance (wavs/ -> demo/assets/audio/<condition>-1-<suffix>.wav):
     clean   <- wavs/AC          (clean AC target, the reconstruction reference)
     mix     <- wavs/Noisy       (AC mixture: target + environmental noise + competing speech)
     bc      <- wavs/BC          (synchronised BC recording, no added corruption)
     fcn | dccrn | mminet | vibvoice | dbmif | focusme  <- wavs/<Model>/
   System outputs were loudness-matched (RMS) to the clean reference of the same
   condition; "clean" and "mix" keep their natural levels so the SNR is audible.
   ========================================================================= */
window.DEMO_DATA = {
  audioDir: 'assets/audio/',

  columns: [
    { suffix: 'clean',    name: 'Clean target',      group: 'ref',      blurb: 'Clean AC target speech: the reconstruction reference (not available to any system)' },
    { suffix: 'mix',      name: 'Noisy AC mixture',  group: 'input',    blurb: 'AC mixture of target + environmental noise + competing speech (system input)' },
    { suffix: 'bc',       name: 'Bone conduction',   group: 'input',    blurb: 'Synchronised BC recording of the same utterance, no added corruption' },
    { suffix: 'fcn',      name: 'FCN',               group: 'baseline', blurb: 'Baseline: time-domain fully convolutional network, early fusion (Yu et al.)' },
    { suffix: 'dccrn',    name: 'DCCRN',             group: 'baseline', blurb: 'Baseline: AC-BC complex-spectrum sensor fusion (Wang et al.)' },
    { suffix: 'mminet',   name: 'MMINet',            group: 'baseline', blurb: 'Baseline: involution-based multimodal mask estimation (Wang et al.)' },
    { suffix: 'vibvoice', name: 'VibVoice',          group: 'baseline', blurb: 'Baseline: audio-vibration fusion with an auxiliary vibration decoder (He et al.)' },
    { suffix: 'dbmif',    name: 'DBMIF',             group: 'baseline', blurb: 'Baseline: deep balanced multimodal iterative fusion (Wu et al.)' },
    { suffix: 'focusme',  name: 'FocusMe (ours)',    group: 'ours',     blurb: 'FocusMe: CAFF cross-attention fusion + FSE frame-level speaker extractor' }
  ],

  conditions: [
    {
      id: 'noise',
      label: 'Environmental noise',
      tag: 'SNR -15 dB',
      note: 'the target speech is 15 dB below the environmental noise, while the competing talker is 10 dB weaker than the target.',
      samples: [
        { id: 'noise-1', title: 'Sample 1', meta: 'Unseen speaker | SNR -15 dB / SIR +10 dB', text: '[transcript pending]' }
      ]
    },
    {
      id: 'speech',
      label: 'Competing speech',
      tag: 'SIR -10 dB',
      note: 'the competing talker is 10 dB above the target speech, with only mild environmental noise.',
      samples: [
        { id: 'speech-1', title: 'Sample 1', meta: 'Unseen speaker | SNR +10 dB / SIR -10 dB', text: '[transcript pending]' }
      ]
    },
    {
      id: 'joint',
      label: 'Noise + competing speech',
      tag: 'SNR -15 / SIR -10 dB',
      note: 'both interferers exceed the target in power - the condition where the advantage of FocusMe is largest.',
      samples: [
        { id: 'joint-1', title: 'Sample 1', meta: 'Unseen speaker | SNR -15 dB / SIR -10 dB', text: '[transcript pending]' }
      ]
    }
  ]
};
