import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Flat ESLint config for the TanStack Start app-builder template. */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".output/**",
      ".vercel/**",
      ".nitro/**",
      "node_modules/**",
      "src/routeTree.gen.ts",
      "src/app/**",
      "src/actions/**",
      "src/middleware.ts",
      "src/auth.ts",
      "src/auth.config.ts",
      "src/types/next-auth.d.ts",
      "src/lib/mail.ts",
      "src/lib/tokens.ts",
      "src/lib/data/transform*.js",
      "src/components/admin/**",
      "src/components/auth/**",
      "src/components/home/**",
      "src/components/listing/wizard/**",
      "src/components/listing/EditListingForm.tsx",
      "src/components/listing/FavoriteButton.tsx",
      "src/components/listing/ListingFilters.tsx",
      "src/components/listing/ListingGallery.tsx",
      "src/components/listing/ListingResults.tsx",
      "src/components/listing/MyListingsActions.tsx",
      "src/components/listing/ShareButton.tsx",
      "src/components/layout/MobileMenu.tsx",
      "src/components/layout/NotificationBell.tsx",
      "src/components/layout/UserNav.tsx",
      "src/components/message/**",
      "src/components/profile/**",
      "src/components/providers/**",
      "src/components/search/**",
      "src/components/ui/alert-dialog.tsx",
      "src/components/ui/carousel.tsx",
      "src/components/ui/drawer.tsx",
      "src/components/ui/form.tsx",
      "src/components/ui/sheet.tsx",
      "src/components/ui/skeleton.tsx",
      "src/components/ui/table.tsx",
      "test-*.js",
      "test-*.ts",
      "prisma/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Disable rules that conflict with Prettier formatting.
  prettier,
);
