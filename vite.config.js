import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    /* « déployer/ » ne contient que des COPIES des fichiers de la racine,
       rassemblées pour être publiées d'un bloc. Sans cette exclusion, Vitest y
       trouve « referentiel.test.js » et joue toute la série deux fois : le
       compte de tests double, et surtout la seconde série éprouve la copie et
       non la source. Le jour où la copie prend du retard sur la racine, la
       suite resterait verte en testant du code périmé.
       Même raison pour « EDIT_EM/ », qui archive d'anciennes versions du code. */
    exclude: ["**/node_modules/**", "**/dist/**", "déployer/**", "EDIT_EM/**"],
  },
});
