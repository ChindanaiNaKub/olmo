export const feedbackAuthBuild = {
  pure: {
    packages: [
      "better-auth",
      "@better-auth/*",
      "@rat-stack/auth",
      "@rat-stack/database",
      "vite",
    ],
  },
};

export const feedbackGatewayBuild = {
  pure: { packages: ["@rat-stack/database"] },
};
