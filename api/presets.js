export default function handler(request, response) {
  const presets = [
    {
      id: 'marble-default',
      model: 'domain-warped-marble',
      params: {
        seed: 20251028,
        scale: 3.2,
        distortion: 1.2,
        complexity: 4,
        contrast: 1.2,
      },
      notes: 'Domain-warped FBM tuned for flowing marble veins.',
    },
  ];

  response.status(200).json({ presets });
}
