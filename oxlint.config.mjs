import theThracian from "@thethracian/oxlint-config";

const config = theThracian({ typeAware: true, effect: true });

export default {
  ...config,
  rules: {
    ...config.rules,
    complexity: ["error", { max: 30 }],
    "max-lines-per-function": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
  },
};
