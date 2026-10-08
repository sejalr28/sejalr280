# NoteTube AI -- backend image
#
# Base image note: sentence-transformers/torch need a fairly complete glibc
# Python image, so this uses the standard (not -slim/-alpine) Python image.
# It's larger, but avoids a long chain of missing-system-library errors.
FROM python:3.12

WORKDIR /app

# Install dependencies first (separate layer) so `docker build` only
# re-installs them when requirements.txt actually changes, not on every
# code edit.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Where FAISS indexes and cached transcripts persist (see docker-compose.yml,
# which mounts these as volumes so they survive a container restart).
RUN mkdir -p /app/faiss_indexes /app/transcript_cache

# Pre-download the embedding + reranker models into the image at build time,
# rather than on first request at runtime. Adds a few minutes to `docker
# build`, but means the first real user request isn't the one paying for a
# ~100 MB download, and the container works with no internet access after
# this point (aside from calls to the Groq API and YouTube).
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; \
    SentenceTransformer('all-MiniLM-L6-v2'); \
    CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

EXPOSE 8000

# GROQ_API_KEY must be supplied at `docker run` / compose time (see
# docker-compose.yml) -- it is never baked into the image.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
