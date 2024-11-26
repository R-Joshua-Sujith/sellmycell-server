const router = require("express").Router();
const fs = require('fs');
const path = require('path');
const multer = require("multer");


router.get('/get-images', (req, res) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = req.query;
        const folderPath = path.join(__dirname, '../uploads');
        const skip = (page - 1) * pageSize;

        // Read the contents of the folder
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error('Error reading folder:', err);
                return res.status(500).send('Error reading folder');
            }

            // Filter files based on search query
            const filteredFiles = files.filter(file => {
                return file.toLowerCase().includes(search.toLowerCase());
            });

            // Filter out non-image files if needed
            const imageFiles = filteredFiles.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif';
            });

            // Get the total count of images
            const totalImages = imageFiles.length;

            // Slice the array of image files to get the images for the requested page
            const imagesForPage = imageFiles.slice(skip, skip + pageSize);

            // Construct an array of objects containing image data for the requested page
            const imageData = imagesForPage.map(file => {
                const filePath = path.join(folderPath, file);
                const data = fs.readFileSync(filePath).toString('base64');
                return {
                    filename: file,
                    data: `data:image/${path.extname(file).slice(1)};base64,${data}`
                };
            });

            // Send the list of image data for the requested page along with total image count as JSON
            res.json({
                totalImages,
                images: imageData.slice(0, pageSize) // Apply the limit here
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});

router.post("/upload-images", upload.array("images", 50), (req, res) => {
    if (req.files.length > 50) {
        return res.status(400).json({ error: "Maximum 50 images allowed" });
    }

    // File upload logic
    const uploadedFiles = req.files.map(file => {
        return {
            filename: file.originalname,
            path: file.path // Path where the file is stored
        };
    });

    // You can further process or store the uploaded files as needed

    res.status(200).json({ message: "Images uploaded successfully", files: uploadedFiles });
});


router.delete("/delete-image/:filename", (req, res) => {
    const deleteFile = (filePath) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
            }
        });
    };
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('File does not exist:', err);
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete the file
        deleteFile(filePath);

        res.status(200).json({ message: 'File deleted successfully' });
    });
});

router.put("/update-filename", (req, res) => {
    const { filename, newFilename } = req.body;

    // Extract the extension from the original filename
    const ext = path.extname(filename);

    // Concatenate the new filename with the original extension
    const newFilenameWithExt = newFilename + ext;

    const oldPath = path.join(__dirname, '../uploads', filename);
    const newPath = path.join(__dirname, '../uploads', newFilenameWithExt);

    // Check if file exists
    fs.access(oldPath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('File does not exist:', err);
            return res.status(404).json({ error: 'File not found' });
        }

        // Rename the file
        fs.rename(oldPath, newPath, (err) => {
            if (err) {
                console.error('Error renaming file:', err);
                return res.status(500).json({ error: 'Error renaming file' });
            }

            res.status(200).json({ message: 'Filename updated successfully' });
        });
    });
});

module.exports = router;