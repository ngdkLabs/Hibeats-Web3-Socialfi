import { createRoot } from "react-dom/client";
import { ApolloProvider } from '@apollo/client/react';
import App from "./App.tsx";
import "./index.css";
import { apolloClient } from './lib/apollo-client';

createRoot(document.getElementById("root")!).render(
  <ApolloProvider client={apolloClient}>
    <App />
  </ApolloProvider>
);
