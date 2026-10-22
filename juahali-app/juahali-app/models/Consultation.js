const mongoose = require('mongoose');
// Doctor's notes for one visit. Only the doctor routes ever read or write this collection (FR-DOC-04, FR-DOC-05).
module.exports = mongoose.model('Consultation', new mongoose.Schema({
  queueEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueEntry', required: true, unique: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, default: '', maxlength: 4000 },        // private to doctors
  advice: { type: String, default: '', maxlength: 2000 }        // written for the patient to read
}, { timestamps: true }));
