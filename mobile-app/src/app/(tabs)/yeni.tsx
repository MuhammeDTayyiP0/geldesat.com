import { Redirect } from 'expo-router';

/** Placeholder for the center tab; its button opens the post-listing flow instead. */
export default function NewListingTab() {
  return <Redirect href="/ilan-ver" />;
}
