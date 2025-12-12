import UploadForm from './components/UploadForm'

export default function UploadPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Upload Climbing Route Photo</h1>
      <p className="mb-6">Upload a GPS-enabled photo to start documenting a new climbing route.</p>
      <UploadForm />
    </div>
  )
}