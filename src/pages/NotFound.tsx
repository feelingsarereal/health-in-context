import { Link } from 'react-router-dom';
export default function NotFound() {
  return (
    <div>
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-3">
        <Link to="/" className="underline">Back to the start</Link>
      </p>
    </div>
  );
}
